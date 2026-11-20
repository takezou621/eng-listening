# オーディオスパイク結果 (2026-11-20)

GM 指示 #3 のオーディオ基盤スパイクの実証記録。検証環境: iPhone 17 Pro (iOS 27.0 シミュレータ) / Xcode 27.2 / Expo SDK 58 / expo-audio。

## 実証したこと

| 要件 | API | 結果 |
| --- | --- | --- |
| 再生 / 一時停止 | `player.play()` / `player.pause()` | ✅ 動作。再生位置・進捗バーが更新される |
| シーク (文単位ジャンプの土台) | `player.seekTo(sec, toleranceMillisBefore, toleranceMillisAfter)` | ✅ 動作。文の開始タイムスタンプへ正確にジャンプ (許容誤差 1ms) |
| 速度変更 0.7 / 0.85 / 1.0 / 1.2 (ピッチ補正) | `player.setPlaybackRate(rate, 'high')` | ✅ 動作。再生中に切替可能。`AudioStatus.playbackRate` / `shouldCorrectPitch` に反映 |
| ロック画面コントロール | `setActiveForLockScreen(true, metadata, options)` + `setAudioModeAsync({ interruptionMode: 'doNotMix', shouldPlayInBackground: true })` | ✅ アクティブ化成功 (メタデータ: タイトル / アーティスト、±5秒シークボタン)。ロック画面の見た目はシミュレータの UI 自動操作ができないため実機/手動での確認手順を docs/dev-setup.md に記載 |
| バックグラウンド再生の土台 | iOS `UIBackgroundModes: ['audio']` (app.config.ts) | ✅ 設定済み |

## 実証の記録 (シミュレータ実行ログ)

`?demo=1` 付きでスパイク画面を開くと、手動操作と同一の API 呼び出しを順次実行する。Metro コンソールの記録:

```text
LOG  [spike] 9:53:52 --- 自動デモ開始 (?demo=1) ---
LOG  [spike] 9:53:52 setAudioModeAsync: doNotMix / shouldPlayInBackground=true
LOG  [spike] 9:53:52 play()
LOG  [spike] 9:53:59 setPlaybackRate(0.7, high) // ピッチ補正あり
LOG  [spike] 9:53:59 setPlaybackRate(1.2, high) // ピッチ補正あり
LOG  [spike] 9:53:59 seekTo(11.23) // 文3の冒頭へ (文単位ジャンプ)
LOG  [spike] 9:53:59 setPlaybackRate(1.0, high)
LOG  [spike] 9:54:02 setActiveForLockScreen(true, metadata, seek±5s)
LOG  [spike] 9:54:02 pause() // デモ終了
```

すべての呼び出しがエラーなしで完走。スクリーンショット (docs/evidence/):

![再生中に速度 1.2x へ変更した様子](evidence/spike-playing-rate1.2.png)
![再生完了後・ロック画面コントロール有効化状態](evidence/spike-finished-lockscreen-active.png)

- `spike-playing-rate1.2.png`: 再生中 (0:09.5 / 0:14.2) に速度 1.2x へ変更。ステータス表示 `rate=1.20 (ピッチ補正ON)` と 1.2x チップの選択状態を確認できる
- `spike-finished-lockscreen-active.png`: 3 文目の冒頭 (11.23s) へのシーク後に再生を完走 (0:14.2/0:14.2)。ボタンが「ロック画面コントロール解除」表示 = `setActiveForLockScreen` が成功している状態

## 手動操作による動作確認 (2026-11-20, idb によるタップ自動化)

シミュレータ上で実際のタップ・長押しを伴う一連の操作を実施し、全タブ・全操作を確認した:

| # | 操作 | 結果 |
| --- | --- | --- |
| 1 | タブ移動 ホーム → プレイヤー → 苦手フレーズ → 設定 → ホーム | ✅ 4 タブすべて遷移・描画正常 |
| 2 | ライブラリで「Asking for Directions」をタップ → プレイヤータブ | ✅ 選択がプレイヤーに反映 (スクリプト 0 文の空状態表示も正しい) |
| 3 | プレイヤーの「オーディオスパイクを開く」をタップ | ✅ スパイク画面へ遷移 |
| 4 | 「▶ 再生」タップ → 「0.7x」タップ | ✅ 再生中に `rate=0.70 (ピッチ補正ON)` へ切替 ([証拠](evidence/spike-manual-rate0.7-seek.png)) |
| 5 | 文2 カードをタップ | ✅ 5.14s へジャンプ (再生位置・進捗バーに反映) |
| 6 | 文1 カードを長押し | ✅ 「リピート中」表示 + 終端到達で 0.00s へ自動ループ ([証拠](evidence/spike-manual-repeat.png)) |
| 7 | 再生終了後 (didJustFinish) にリピート有効化 | ✅ 0.00s へ戻して自動再開 (最終文 / 終端 == duration の修正が効いている) |

手動操作のログ (Metro コンソール):

```text
LOG  [spike] 10:48:31 play()
LOG  [spike] 10:48:33 setPlaybackRate(0.7, high)  // ピッチ補正あり
LOG  [spike] 10:48:35 seekTo(文2 冒頭 5.14s)
LOG  [spike] 10:48:39 seekTo(文1 冒頭 0.00s)
LOG  [spike] 10:49:31 文1 リピート開始
LOG  [spike] 10:49:31 文リピート: 0.00s へ戻す
LOG  [spike] 10:49:38 文リピート: 0.00s へ戻す
LOG  [spike] 10:49:39 文リピート: 0.00s へ戻す
```

### 判明した改善点 (ABリピート実装時に対応)

- 終端到達後のシーク完了待ちの数 tick でリピート判定が重複発火する (重複 seek は無害だがログが散る)。#9 実装時にデバウンスする
- 文リピート解除はもう一度長押しで行う設計。UI での選択解除ボタンの要否は #9 で検討

## サンプル音声

`assets/audio/spike-sample.m4a` — macOS `say` + `ffmpeg` で生成した 14.24 秒・3 文の音読 (会話: レストラン予約)。文ごとの開始秒 (0.00 / 5.14 / 11.23) は `src/features/spike/sample.ts` に定義。本実装ではコンテンツパイプライン (#1–#3) の Whisper 強制アライメント出力に置き換える。

## わかったこと / 次フェーズへの反映

1. **expo-audio で要件を充足できる** — ネイティブコード追加なしで再生・シーク・速度変更 (ピッチ補正)・ロック画面コントロールまで動く。`react-native-track-player` は不要
2. **ロック画面コントロールには `interruptionMode: 'doNotMix'` が必要** (expo-audio の仕様)。`mixWithOthers` のままでは OS がプレイヤーと紐付けない
3. **文単位リピート (ABリピートの土台)** は `seekTo` + 再生位置監視で実装できることをスパイク画面に実装済み (文カード長押し)。#9 の AB リピートへそのまま展開できる
4. 速度は `AudioStatus.playbackRate` から読み取れるため、カラオケ同期 (#6) の時間計算は実速度で補正可能
5. Android は未検証 (エミュレータなし)。Android 実機/エミュレータでの確認は次フェーズの最初に実施する
