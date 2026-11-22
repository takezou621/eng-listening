# コンテンツパイプラインを Google Colab GPU で実行する

`tools/content/` のレッスン生成パイプラインは、Mac mini (ローカル) と Google Colab (GPU ランタイム) のどちらでも実行できます。この文書は使い分けと Colab での手順をまとめた運用ランブックです。

ノートブック: `tools/content/colab/eng-listening-content-pipeline.ipynb`

## 何がどこで動くか

| 工程 | 内容 | Mac mini (従来) | Colab |
|---|---|---|---|
| `generate_lesson.py` | 台本 JSON → Cloud TTS で行 WAV を `build/<id>/` に生成 | gcloud ユーザー認証 (takezou621@gmail.com) | ADC (`auth.authenticate_user()`) + `EL_TTS_AUTH_FALLBACK=adc` |
| `check_voice_consistency.py` | 声の一貫性ゲート (F0 / 発話速度の外れ値検出) | CPU | CPU (そのまま) |
| `build_lesson.py` | 行 WAV 連結 → m4a 化 + faster-whisper 単語アライメント → `assets/lessons/<id>/lesson.json` | cpu / int8 (遅い) | **cuda / float16 (高速)**。`EL_WHISPER_DEVICE` / `EL_WHISPER_COMPUTE_TYPE` で上書き |

Colab 化のためのコード側シムは 2 つだけです。それ以外のパイプライン本体は共通です。

- `cloud_tts.py`: 環境変数 `EL_TTS_AUTH_FALLBACK=adc` が設定され、かつ gcloud 呼び出しが失敗した場合に限り、Application Default Credentials (`google.auth.default()`) でトークンを取得します。未設定時の動作は従来どおりです。クォータプロジェクトは従来どおり voice_config.json の `quotaProject` (muse-gemini-514814) を `X-Goog-User-Project` ヘッダで送ります。
- `build_lesson.py`: 環境変数 `EL_WHISPER_DEVICE` / `EL_WHISPER_COMPUTE_TYPE` があれば voice_config.json の `whisper.device` / `whisper.computeType` より優先します。未設定なら設定ファイルの値 (cpu / int8) です。

## Colab を使う場面

- **新規レッスンの生成**: TTS 生成 + アライメントを一気に回すとき。
- **再アライメント**: 既存レッスンの単語タイムスタンプを作り直すとき (例: Issue #73 の phone-appointment「Miller」の 60ms タイミング)。行 WAV (`build/<id>/`) が Drive 経由で Colab に渡っていれば、TTS 再生成なしに `build_lesson.py` だけを GPU で再実行できます。
- 小さな台本修正の再生成など、数行で終わる作業は Mac mini で十分です。

## 手順

1. GitHub で `tools/content/colab/eng-listening-content-pipeline.ipynb` を開き、「Open in Colab」で Colab に開く (または Colab の「ファイル > ノートブックをアップロード」)。
2. Colab に **takezou621@gmail.com** でサインインしていることを確認する。
3. ランタイム > ランタイムのタイプを変更 でハードウェア アクセラレータに **GPU (T4)** を選ぶ。
4. ノートブック冒頭のパラメータセルで `LESSON_ID` と `BRANCH` を対象に合わせる。
5. 「ランタイム > すべてのセルを実行」。流れは次のとおりです。
   - ランタイム確認 (GPU / ffmpeg)
   - Drive マウント → リポジトリ clone → **Sync In** (Drive の `usage/` と `build/` を取り込む)
   - uv で依存同期 + CUDA チェック
   - ADC 認証 (アカウント表示で takezou621@gmail.com を確認)
   - `generate_lesson.py` → `check_voice_consistency.py` → `build_lesson.py`
   - 出力検証 (全単語の start < end を assert。phone-appointment では Miller の duration も表示)
   - **Sync Out** (Drive へ `usage/`・`build/<id>/`・`assets/lessons/<id>/` を保存) + 成果物 zip のダウンロード
6. Mac mini 側で Drive から成果物を取り込み、差分を確認して **PR 経由** で main に入れる。

## 共有台帳のルール (重要)

- 月間文字数カウンタ (`tools/content/usage/`) と生成途中物 (`build/`) は、Drive の `eng-listening-content/` を正として Mac mini と Colab で共有します。
- **同期せずに両環境で生成しないこと。** 台帳がずれると二重に文字数を消費したり、上限判定が崩れます。
- Colab で生成したら、Mac mini 側の `usage/` にも Drive の内容を反映してから次の生成を行います。

## 結果をリポジトリへ戻す

- `assets/lessons/<id>/` の差分 (lesson.json + audio.m4a) を Mac mini のリポジトリに取り込み、内容を確認して PR を作ります (main への直接 push は禁止)。
- 再アライメントのみの場合も、生成元 (`tools/content/lessons/`) は変更されないため、差分は `assets/lessons/` と Watch 用コピー (`targets/watch/Lessons/`、再同期は `tools/watch-assets/sync_watch_assets.sh`) が対象です。

## トラブルシューティング

- **CUDA が見えない** → ランタイムのタイプが GPU になっているか確認し、ランタイムを再起動して最初から実行する。ctranslate2 の CUDA デバイス数が 0 の場合、ノートブックは cpu / int8 にフォールバックして続行します (遅くなります)。
- **TTS が 403** → ADC のアカウントが takezou621@gmail.com か確認する。X-Goog-User-Project ヘッダ (quotaProject) は自動で付きます。
- **一貫性ゲートが落ちる** → 外れ値の行 WAV を削除して生成からやり直す。声・設定は voice_config.json が正で、Colab 側で変えないこと。
- **CU 消費** → T4 が最も安い GPU です。アライメントは 1 レッスン数分程度で消費は小さいです。作業が終わったらランタイムを切断してください (起動したまま放置すると消費が増えます)。
