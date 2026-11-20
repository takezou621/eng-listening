# コンテンツ生成パイプライン (TTS)

レッスン台本 JSON から音声付きレッスン (アプリが読む JSON + 音声ファイル) を生成する
パイプライン。音声生成の「仕組み」はアニメ日本史ラボ (`~/dev/anime_japanese_history`
の `tools/audio/`) の YouTube 動画制作と同一で、TTS エンジンだけ Google Cloud
Text-to-Speech に置き換えている (GM 決定: Gemini TTS はアニメ側と 1 日 50 リクエスト枠を
取り合わないため)。

対象 Issue: #2 (TTS 音声合成) / #3 (faster-whisper 単語タイムスタンプ) のスパイク。

## 全体の流れ

```
tools/content/lessons/<id>.json      # 入力: 台本 (話者・英文・チャンク・直訳・リンキング注釈)
        │  ① generate_lesson.py      行ごと Cloud TTS 生成 (文字数カウンタ付き)
        ▼
tools/content/build/<id>/lines/*.wav # 中間生成物 (gitignore、削除して再生成できる)
        │  ② check_voice_consistency.py  一貫性ゲート (F0 / words-per-sec)
        ▼
        │  ③ build_lesson.py         連結 → m4a、faster-whisper で単語タイムスタンプ
        ▼
assets/lessons/<id>/                 # 出力: アプリが読む成果物 (コミットする)
  ├ lesson.json                      #   文・単語・チャンクのタイムスタンプ + 注釈
  ├ audio.m4a                        #   連結済み 1 トラック (AAC)
  ├ manifest.json                    #   config hash と生成メタ (混在防止)
  └ voice_consistency_report.json    #   ゲートの測定値と合否
```

アプリ側は `src/features/lesson/cafeLesson.ts` が `assets/lessons/cafe-ordering/` を
require し、`/lesson` 画面 (`src/app/lesson.tsx`) で再生・カラオケ表示・文シークをする。

## ゼロコスト制約 (絶対条件)

- 使う声は **Neural2 系のみ** (無料枠: 月 100 万文字)。Studio / Chirp 等の有料単価の
  高い声は `cloud_tts.py` のガードで拒否する。
- パイプラインは月間文字数カウンタ (`tools/content/usage/monthly-YYYY-MM.json`) を持ち、
  **当月累計が 90 万文字 (monthlyStopChars) に達したら生成を停止**して報告する。
  無料枠超過による課金を未然に防ぐためのマージンである。リクエストは成功したものだけ
  加算し、レッスン別の内訳も記録する。
- 課金が発生する設定変更 (API の追加有効化、予算設定の変更など) は行わない。
  必要になったら作業を止めて GM に報告する。

## 認証とクォータプロジェクト

- 認証はこの PC の既存 gcloud ユーザー認証 (`takezou621@gmail.com`) を使う。
  トークンは `gcloud auth print-access-token` で毎回取得し、**ログ・PR・コミットに
  値を出さない**。
- ユーザー認証トークンで呼ぶ際は `X-Goog-User-Project: muse-gemini-514814` ヘッダが
  必須 (無いと 403)。ヘッダ値は voice_config.json の `quotaProject` が唯一の情報源。
- プロジェクトは muse-gemini-514814 (Cloud TTS API 有効化済み)。設定変更はしない。

## 単一構成固定と設定ハッシュ

- 生成パラメータ (声・言語・話速・ピッチ・エフェクトプロファイル) は
  `tools/content/voice_config.json` **だけ**が正。行ごとの場当たり的な変更をしない。
- 障害時も別エンジン・別声へ切り替えない (待って再開する)。フォールバック実装は
  意図的に持たない。
- `generate_lesson.py` は出力先 `manifest.json` に config hash (SHA-256 先頭 16 文字) を
  記録し、**異なる hash の既存音声が同じ出力先にある場合は生成を中止**する。
  voice_config.json を変更して作り直すときは `assets/lessons/<id>/` と
  `tools/content/build/<id>/` を消してから再実行する。

## ウォッチドッグ

- TTS 呼び出しはタイムアウト 180 秒 (`watchdog.timeoutSec`)。ハングしたら自動で切断し、
  上限付きリトライ (3 回 / バックオフ 15・30・60 秒) の後に諦めてエラー報告する。

## 一貫性ゲート (英語向けの適応)

`check_voice_consistency.py` が行 WAV を測定し、話者ごとの中央値から外れた行を弾く。
基準は本家と同じで、速度だけ英語向けに words/sec にしている:

- F0 (基本周波数) 偏差 > 15%
- 発話速度偏差 > 25% (words/sec)

合否は `voice_consistency_report.json` に記録される。FAIL の場合は:

```bash
rm tools/content/build/cafe-ordering/lines/L03_female.wav   # 該当行を削除
uv run --project tools/content python tools/content/generate_lesson.py --lesson cafe-ordering
uv run --project tools/content python tools/content/check_voice_consistency.py --lesson cafe-ordering
```

## 実行手順 (リポジトリ ルートで)

```bash
# 0) 依導入は不要 (uv が tools/content/pyproject.toml から環境を作る。av は 15.x 系に固定)

# 1) 行ごとの TTS 生成 (文字数カウンタ・manifest 付き)
python3 tools/content/generate_lesson.py --lesson cafe-ordering

# 2) 一貫性ゲート (FAIL なら上記の再生成フロー)
uv run --project tools/content python tools/content/check_voice_consistency.py --lesson cafe-ordering

# 3) 連結 + faster-whisper で単語タイムスタンプ → アプリ用出力
uv run --project tools/content python tools/content/build_lesson.py --lesson cafe-ordering

# lint / typecheck
npm run lint && npm run typecheck
```

faster-whisper は初回に base.en モデル (~75MB) をダウンロードする。
ビルドは whisper の出力を**タイムスタンプのみ**に使う (文字面は台本が正。
whisper が "nine fifty" を "950." のように書くため、difflib でアラインして
台本の単語に Timing を分配する)。

## 入力台本 (lessons/<id>.json) の形式

```jsonc
{
  "id": "cafe-ordering",             // 出力ディレクトリ名とも一致させる
  "title": "Ordering at a Café",
  "titleJa": "カフェで注文する",
  "type": "conversation",            // conversation | monologue
  "level": "beginner",
  "category": "cafe",
  "speakerNames": { "female": "Barista", "male": "Customer" },
  "lines": [
    {
      "index": 1,                    // 1 起算。ファイル名 L01_<speaker>.wav に使う
      "speaker": "female",           // voice_config.json の voices キー
      "text": "Hi. I'd like a medium latte, please.",
      "chunks": ["Hi.", "I'd like a medium latte", "please."],  // スラッシュ表示の区切り
      "translationJa": "こんにちは。ミディアムサイズのラテをお願いします。",  // 直訳
      "linking": [                   // 音の変化の注釈 (表示は #7)
        { "span": "I'd like a", "type": "linking", "ipa": "/aɪd laɪk‿ə/",
          "noteJa": "ひと続きで発音する。" }
      ]
    }
  ]
}
```

- 生成単位は「文 (行)」。全行で同一構成の TTS を使い、単語レベルの時間は生成後の
  faster-whisper で付ける (#3)。カラオケ表示 (#6)・文シーク (#9) と接続する。
- monologue レッスンは `speaker: "narrator"` を使う (会話レッスンでは不使用)。

## 声の選定 (2026-11-20 実測)

同一文章 (99 文字) で候補 6 声を合成し、F0 と話速を実測して選んだ
(`_voice_audition` としてカウンタに記録済み):

| 候補 | 用途 | F0 中央値 | 話速 | 採用 |
|---|---|---|---|---|
| en-US-Neural2-F | 女性話者 | 228.6 Hz* | 3.01 w/s* | ○ (GM 第一候補。デモ実績あり) |
| en-US-Neural2-D | 男性話者 | 140.4 Hz | 3.50 w/s | ○ (候補中最低 F0 で男女差が最大、話速も中庸) |
| en-US-Neural2-A | ナレーター | 171.4 Hz | 3.34 w/s | ○ (落ち着いた中音域でナレーション向き。話速は最も安定) |
| en-US-Neural2-J | (比較) | 142.0 Hz | 3.47 w/s | × (D と特性が重複) |
| en-US-Neural2-I | (比較) | 149.5 Hz | 3.65 w/s | × (話速が最も速く D と近い) |
| en-US-Neural2-C / E | (比較) | 175–178 Hz | 3.3–3.4 w/s | × (女性は F を継続) |

\* F は本レッスン 10 文のゲート実測値 (voice_consistency_report.json)。男女の F0 差は
約 94 Hz あり、声の混同がないことをゲートが毎回検証する。

## 使用文字数の実績 (2026-11-20, muse-gemini-514814)

| 用途 | 文字数 | リクエスト数 |
|---|---|---|
| 手動接続確認 | 3 | 1 |
| 声のオーディション (6 声) | 594 | 6 |
| カフェ注文レッスン (10 行) | 476 | 10 |
| **当月累計** | **1,073 / 900,000** | **17** |

無料枠 (月 100 万文字) の 0.1% 未満。カウンタは `tools/content/usage/monthly-2026-11.json`。

## 再実行・量産のときの注意

- 台本を書いたら `--lesson <id>` で上記 3 ステップを実行するだけ。
  途中失敗しても再実行すると**既存の行はスキップ**され、欠けている行だけ再生成される
  (請求は未生成分だけ)。
- 特定行だけ作り直すときは `--line N` (複数指定可)。
- 出力は当面リポジトリ内 `assets/lessons/` に置く (#4 の R2 配信は別 Issue)。
  audio.m4a は 64kbps AAC で 37 秒のレッスンが約 280KB。
- 残り 11 本の量産は型が固まってから別途指示する (本 PR は 1 本のスパイク)。
