# App Store 申請記録

ミミトレ (App ID 6837503600) の審査提出記録。run ID・時刻・ゲート結果を残す。

## v1.1 (build 8) — 2026-11-24

- セッション開始: 2026-11-24 17:19 JST / **審査提出 (WAITING_FOR_REVIEW 確認): 20:27 JST**
  (所要 3 時間 08 分 — 3 時間ルールを 8 分超過。理由と経緯は下記の試行記録のとおり)
- main: `eadf5a7` (PR #110 マージ後) を出発点にし、提出中に発覚した watch バンドル
  の修正を PR #111 として追加 (`26c052c`)

### 経路と試行の記録

| # | 経路 | 開始 (JST) | 結果 |
|---|---|---|---|
| 1 | workflow run 45355981038 (mode=upload, m1 ランナー) | 17:25 | アーカイブの watch.app CodeSign が停滞 — 18:05 にキャンセル。タイムアウトではなく停滞が原因 (timeout は PR #110 で 180 分に改正済み) |
| 2 | m1 上で直接 `appstore-upload.sh` (SSH nohup) | 18:09 | `errSecInternalComponent` で失敗 — SSH セッションからはログインキーチェーンにアクセスできない (docs/operations.md §1.1 の既知問題) |
| 3 | m1 LaunchAgent (GUI セッション bootstrap) | 18:16 | codesign がキーチェーン承認待ちで停滞。孤立 codesign プロセスが同日朝のランナー run から 6 時間以上残存 — m1 は人手の「常に許可」がないと codesign を完結できないと判断し断念 |
| 4 | m4 (Mac mini) LaunchAgent でローカル Archive | 18:29 | 19:33 頃 ARCHIVE FAILED (RevenueCat.framework の codesign internal error。監督側の Mac mini ログアウトと重なった可能性) |
| 5 | m4 再開 (増分) | 19:44 | altool が Apple サーバーエラー (-19241)。書き出し済み .ipa の直接再試行で **ITMS-90713**: watchkitapp に `CFBundleIconName` 無し |
| 6 | 修正 (PR #111 前半) 後に m4 再開 | 19:59 | **ITMS-90362**: watchkitapp の `WKBackgroundModes=audio` が無効値 |
| 7 | 修正 (PR #111 全体) 後に m4 再開 | 20:06 | **20:10 アップロード成功** (altool "No errors uploading archive")。20:13 に build 8 = PROCESSING、**20:14 頃 VALID 確認** |

- 成功経路: **m4 (Mac mini) ローカル Archive + ASC アップロード** — 認可済みフォールバック
  (`scripts/release/appstore-upload.sh --version 1.1 --build 8 --upload` を GUI セッションへ
  bootstrap した一時 LaunchAgent から実行。docs/operations.md §1.1 の既知手順)。
  m1 ランナー経路は codesign のキーチェーン未整備のため今回は不使用
- workflow `timeout-minutes` は PR #110 で 60 → 180 分に改正 (提出セッション冒頭で main に
  マージ、`eadf5a7`)。この後の upload は全て Actions の timeout 外で実行

### 提出中に発覚・修正した内容 (PR #111 → `26c052c`)

- watch バンドル (`com.takezou.englistening.watchkitapp`) は v1.1 で初めて審査に含まれ、
  Apple の自動検証で 2 件の修正が必要だった:
  1. **ITMS-90713**: `CFBundleIconName` が無い → `expo-target.config.js` に `icon` を追加
     (@bacons/apple-targets が AppIcon.appiconset を自動生成) + Info.plist に
     `CFBundleIconName=AppIcon` を追加
  2. **ITMS-90362**: `WKBackgroundModes=audio` は無効値 (audio は UIBackgroundModes の値) →
     `UIBackgroundModes=audio` に置換。宣言の意味は不変 (画面オフでも再生継続)
- アプリ本体の挙動・課金・価格・法務・プライバシー申告は変更していない

### 提出前ゲートの結果

- **最終バイナリ NS*UsageDescription 監査** (docs/operations.md §1.2):
  - `NSMicrophoneUsageDescription` =
    「シャドーイング練習であなたの発音を録音し、この端末の中でお手本の音声と聞き比べるために使用します。録音した音声が外部に送信されることはありません。」
    — 用途・外部送信の有無を明記した確定文 (v1.0 リジェクト対策文の維持)
  - その他の `NS*UsageDescription` は無し (アーカイブ直後 Info.plist とアーカイブ済み
    .app の両方でスクリプトのゲートが通過 — `[4/7] 用途文字列ゲート` +
    `アーカイブ検証 OK: version=1.1 build=8` を実行ログで確認)
- spec: `dist/appstore/release-1.1.json` (version 1.1 / build 8 / AFTER_APPROVAL /
  phasedRelease false / What's New ja) — 提出前にローカル生成で検証済み
- `usesNonExemptEncryption = false` を build 8 に設定 (ASC の submit 検証で必須指摘、
  API PATCH で反映)
- watch スクリーンショット: v1.1 から watch バンドルが審査に含まれるため ASC が要求。
  Watch シミュレータ (Apple Watch Series 12 46mm) で実画面 2 枚 (416x496 =
  APP_WATCH_SERIES_10 規定サイズ) を撮影し `asc-submit screenshots` で ja セットに登録

### ASC 状態遷移 (最終)

- build 8: PROCESSING (20:13) → **VALID** (20:14 確認)
- apply: version 1.1 作成 + What's New / 説明 / キーワード / サブタイトル / 審査メモ反映 +
  build 8 割当 (20:18、asc-submit run)
- submit: 1 回目は 2 件の検証拒否 (watch スクリーンショット + 暗号申告) → 修正後
  **20:25 提出** → version 1.1 = **WAITING_FOR_REVIEW** (20:27 確認)
- reviewSubmission `2969677e-…` (iOS): WAITING_FOR_REVIEW、item は appStoreVersion 1 件のみ
- サブスクリプション (Premium Annual / Monthly) とグループ (Premium): **APPROVED のまま**
  — v1.1 は IAP の価格・メタデータ変更を含まないため同時提出対象外
  (v1.0 の「サブスクも同時提出」ルールは IAP 変更を含む提出が対象)

### 教訓 (次回改善)

- m1 ランナーは codesign のキーチェーン承認が未整備 (GUI セッションで 1 回「常に許可」
  するか `security set-key-partition-list` を設定するまで、archive を伴う upload は
  m4 ローカル経路が安全)
- watch ターゲットを初めて審査へ含めるリリースでは、アイコン (CFBundleIconName) と
  WKBackgroundModes の値、watch スクリーンショット、暗号申告を事前チェックリストに入れる
- asc-submit / altool の JWT は約 20 分で失効する。VALID 待ちを挟む自動チェーンは
  トークンを再生成する構造にする
