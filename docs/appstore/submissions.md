# App Store 申請記録

ミミトレ (App ID 6837503600) の審査提出記録。run ID・時刻・ゲート結果を残す。

## v1.5 (build 12) — 2026-11-26

- セッション開始: 2026-11-26 07:34 JST / **審査提出 (WAITING_FOR_REVIEW 確認): 08:56:52 JST**
  (所要 **1 時間 22 分** — 3 時間ルール内)
- 内容テーマ: #95 苦手フレーズの連続プレイリスト復習と音変化タイプ別フィルタ。
  `phrases.tsx` に `Chip variant="outlined"` の音変化タイプ別フィルタ (登録済みタイプのみ・件数順、
  ステータスフィルタと AND)。新規 `PhrasePlaylistSheet` で「連続で復習する」を追加
  (モデル音声の自動再生 + カラオケ風表示 / シャドーイング (録音 → 自動再生) の排他切替、
  文末で次文へ自動進行。プレイヤー・録音は文/モード切替・閉じる・アンマウントで解放)。
  新規計測イベント `weak_phrase_playlist_started` / `_finished` を `docs/metrics.md` に先行定義。

### 経路の記録

| 手順 | 経路 | 時刻 (JST) | 結果 |
|---|---|---|---|
| 着手前事前確認 | ローカル + ASC API | 07:35–07:40 | (a) Watch: `CFBundleIconName=AppIcon`・アイコンは prebuild で生成されることを確認 (b) Watch スクリーンショット: ja セット `APP_WATCH_SERIES_10` の登録を確認 → 既存を再利用 (c) `usesNonExemptEncryption` は spec に含まれない → VALID 後に API PATCH で対応 (v1.2〜1.4 と同一手順) |
| 実装 | Orchestrator + omp (`~/.local/bin/omp` 19.1.1、 既定モデル) → Orchestrator レビュー | 07:37–08:24 | metrics.md → タイプ別フィルタ → プレイリスト。lint / typecheck PASS。シミュレータ (Mimitore-67) で Light/Dark 撮影 (`docs/ui/phrases-playlist-95/`) |
| PR | PR #121 → squash マージ `54c61e1` | 08:24–08:42 | cubic: skipping / GitGuardian: PASS。CodeRabbit 指摘 6 件 (5 件対応、`prepareToRecordAsync` 指摘は既存レッスン画面と同じ JS `record()` 経路のため対応せず)。スレッド解決後にマージ |
| upload (第一候補) | GitHub Actions (m1-eng-listening run 45723425636) | 08:42–08:45 | failure (m1 の SourcePackages 削除権限エラー Code=513 が再発、exit 74)。再試行せず切替 |
| upload (切替) | **m4 (Mac mini) ローカル** `appstore-upload.sh --version 1.5 --build 12 --upload` (Aqua セッション直実行) | 08:45–08:51 | **アップロード成功** (altool "UPLOAD SUCCEEDED with no errors")。build id `3f81c1d3-4dae-4e3c-a7da-6dab1ddbc1e2`。アーカイブ検証 OK: version=1.5 build=12 |
| VALID 確認 | ASC API (builds) | 08:56 | **build 12 = VALID** |
| 暗号申告 | ASC API PATCH | 08:56 | `usesNonExemptEncryption = false` を build 12 に事前適用 |
| apply | ローカル asc-submit run (run `20261126-085610-9887`) | 08:56 | version 1.5 作成 (`7e1cfa64-4c42-44a4-8410-7a3edd02f79b`) + build 12 割当 + メタデータ (What's New ja / 説明 / キーワード / サブタイトル / 審査メモ / phased release) 反映 |
| submit | ローカル asc-submit submit | 08:56:30 | **提出成功** (version 1.5 submitted for review) |
| status | ローカル asc-submit status + ASC API | 08:56:52 | **version 1.5 = WAITING_FOR_REVIEW** / releaseType AFTER_APPROVAL。サブスクは IAP 変更なしのため提出対象外 (v1.4 と同じ) |

- **upload 経路: m4 ローカルへ切替** — 第一候補の GitHub Actions ワークフロー (m1-eng-listening) が
  v1.4 と同じ m1 ランナーの SPM DerivedData 権限エラー (Code=513) で失敗したため、本実施プロンプトの
  指定どおり直ちに m4 ローカル経路へ切り替えてアップロード成功。
- **CI**: このリポジトリには PR 向け GitHub Actions ワークフローは無し (App Store ワークフローのみ)。
  PR のチェックは cubic / CodeRabbit / GitGuardian。ローカル `npm run lint` / `npm run typecheck` PASS。

### 提出前ゲートの結果

- **最終バイナリ NS*UsageDescription 監査** (docs/operations.md §1.2、アップロードした `.ipa` を展開した
  `Payload/app.app/Info.plist` で全件列挙。ネストした全バンドル (frameworks / plugins / Watch) も走査):
  - `NSMicrophoneUsageDescription` =
    「シャドーイング練習であなたの発音を録音し、この端末の中でお手本の音声と聞き比べるために使用します。録音した音声が外部に送信されることはありません。」
    — 確定文を維持 (スクリプトの用途文字列ゲート `[4/7]` PASS)
  - `NSLocalNetworkUsageDescription` =
    "Expo Dev Launcher uses the local network to discover and connect to development servers running on your computer."
    — expo-dev-client の既定文 (v1.1〜v1.4 と同一条件、審査通過実績あり)
  - 上記 2 件のみ (それ以外の NS*UsageDescription は無し、プラグイン既定文 "Allow ... to access" は 0 件)
  - 同梱 Watch バンドル: NS*UsageDescription 0 件・`CFBundleIconName = AppIcon`・version 1.5 / build 12 を確認
- **spec**: `dist/appstore/release-1.5.json` (version 1.5 / build 12 / AFTER_APPROVAL / phasedRelease false / What's New ja) — validate PASS
- **UI ルールブック** (PR #121 に §3 点検数値を記載): P1 プライマリ = 一覧 1 / シート 1 / P2 初期ブロック 5 / P3 下部 1 段 / P4 2 行超 0 / P5 内部文字列 0 / P6 見出し 0・モード排他 / P7 新規色定数なし。Light/Dark 実画面確認済み。
- **W7 / W8**: W7 = 変更画面を Light/Dark 両モードで撮影・確認。W8 = 設問内容の diff ゼロのため既存結果を引き継ぎ。
- watch スクリーンショット: 既存登録済みの実物を引き継ぎ (watch バンドルの内容変更なし・新規取得不要)。
- iPhone Duo XCUITest: レイアウト大変更ではない (チップ 1 行とボトムシート) ため未実施 — 実機確認は TestFlight で実施。

### 教訓 (次回改善)

- m1 ランナーの Code=513 は v1.4 から未解決のまま。`actions-runner-eng-listening/_work/.../dist/appstore/derived` の
  所有権を整備するまで、upload は m4 ローカル (Aqua セッション直実行、アーカイブ約 5 分) が実質の最短経路。
- `usesNonExemptEncryption=false` は spec / asc-submit に含まれていないため、毎回 VALID 後に手動 PATCH が必要。
  `appstore-spec.py` と asc-submit の build 割当に組み込めば手順を 1 つ減らせる。
- omp の実装にはデバッグ用の `fetch('http://127.0.0.1:…')` が残ることがある (本版でも 2 ファイルで発生、マージ前に除去)。
  omp の成果物はマージ前に `grep -n "dbg\|fetch(" ` で必ず確認する。

---

## v1.4 (build 11) — 2026-11-26

- セッション開始: 2026-11-26 01:11 JST / **審査提出 (WAITING_FOR_REVIEW 確認): 02:54:10 JST**
  (所要 **1 時間 43 分** — 3 時間ルール内)
- 内容テーマ: #93 診断結果の推薦レッスンをホーム「今日の1本」・復習キューへ接続。
  診断由来の推薦レッスンIDおよび弱点音変化タイプを `userStore.ts` に保持し、ホーム画面の「今日の1本」で初回未完了時・直近診断直後に該当推薦レッスンを優先提示。復習キューでも診断弱点タイプ・推薦レッスンを情報源として上位提示。
  `DuoSmokeTests.swift` のアクセシビリティラベル要件 (今日の1本) を維持。

### 経路の記録

| 手順 | 経路 | 時刻 (JST) | 結果 |
|---|---|---|---|
| 実装 | Orchestrator + omp (仕様整合) | 01:50–02:22 | `userStore.ts` / `onboarding.tsx` / `index.tsx` / `phrases.tsx`。型チェック・lint・後方互換を完全検証 |
| PR | PR #119 (feat + v1.4 バージョン準備) → squash マージ `2c1a70f` | 02:32–02:33 | cubic: skipping / GitGuardian: PASS。指摘なしでマージ |
| upload (第一候補) | GitHub Actions (m1-eng-listening run 45665959166) | 02:33–02:36 | failure (m1 ランナー上の xcodebuild SPM パッケージ解決権限エラー: SourcePackages ファイル削除で Operation not permitted、exit 74) |
| upload (切替) | **m4 (Mac mini) ローカル** `appstore-upload.sh --version 1.4 --build 11 --upload` | 02:42–02:48 | **アップロード成功** (altool "UPLOAD SUCCEEDED with no errors")。**Delivery UUID `6403857c-f752-43fd-bde9-f4010187dc82`** (ASC uploadedDate 02:49:49 JST)。アーカイブ検証 OK: version=1.4 build=11 |
| VALID 確認 | ASC API (builds) | 02:53 | **build 11 = VALID** |
| 暗号申告 | ASC API PATCH | 02:53 | `usesNonExemptEncryption = false` を build 11 に事前適用 (submit 1 回目で成功させるための標準手順) |
| apply | ローカル asc-submit run (run `20261126-025351-d8e2`) | 02:53 | version 1.4 作成 (`c72e1ddf-5a93-42ad-9d53-0ee1b817e624`) + build 11 割当 + メタデータ (What's New ja / 説明 / キーワード / サブタイトル / 審査メモ / phased release) 反映 |
| submit | ローカル asc-submit submit (run `20261126-025410-7ee6`) | 02:54:10 | **提出成功** (version 1.4 submitted for review) |
| status | ローカル asc-submit status | 02:54 | **version 1.4 = WAITING_FOR_REVIEW** / releaseType AFTER_APPROVAL |

- **upload 経路: m4 ローカルへ切替** — 第一候補の GitHub Actions ワークフロー (m1-eng-listening) が m1 ランナーの SPM DerivedData キャッシュ権限エラーで失敗したため、本実施プロンプトの指定どおり直ちに m4 ローカル経路 (`scripts/release/appstore-upload.sh`) へ切り替えてアップロード成功。
- **apply / submit 経路: m4 ローカル asc-submit** (`~/dev/asc-submit`・ローカル鍵 `AuthKey_8HM846FQ5Z.p8`)。spec は `dist/appstore/release-1.4.json`。

### 提出前ゲートの結果

- **最終バイナリ NS*UsageDescription 監査** (docs/operations.md §1.2、アーカイブ済み `.app` Info.plist で全件列挙):
  - `NSMicrophoneUsageDescription` =
    「シャドーイング練習であなたの発音を録音し、この端末の中でお手本の音声と聞き比べるために使用します。録音した音声が外部に送信されることはありません。」
    — 確定文を維持 (スクリプトの用途文字列ゲート `[4/7]` PASS)
  - `NSLocalNetworkUsageDescription` =
    "Expo Dev Launcher uses the local network to discover and connect to development servers running on your computer."
    — expo-dev-client の既定文 (v1.1 / v1.2 / v1.3 と同一条件、審査通過実績あり)
  - 上記 2 件のみ (それ以外の NS*UsageDescription は無し)
  - 同梱 Watch バンドル (`app.app/Watch/watch.app`): NS*UsageDescription 0 件・`CFBundleIconName = AppIcon` 維持・`CFBundleShortVersionString 1.4` を確認
- **spec**: `dist/appstore/release-1.4.json` (version 1.4 / build 11 / AFTER_APPROVAL / phasedRelease false / What's New ja) — validate PASS
- **UI ルールブック** (PR #119 に §3 点検数値を記載): P1 プライマリ 0 / P2 ブロック既存内 / P5 内部文字列 0 / P6 セクション見出し既存内 / P7 既存部品のみ。Light/Dark 視認性確認済み。アクセシビリティラベル要件「今日の1本」維持。
- **W7 / W8**: W7 = 既存デザイントークン利用により Light/Dark 両モード視認性維持。W8 (診断設問の全問目視) = 設問内容の diff ゼロのため既存結果を引き継ぎ。
- watch スクリーンショット: 既存登録済みの実物を引き継ぎ (watch バンドルの内容変更なし・新規取得不要)。

---

## v1.3 (build 10) — 2026-11-25

- セッション開始: 2026-11-25 08:15 JST / **審査提出 (WAITING_FOR_REVIEW 確認): 10:36:17 JST**
  (所要 **2 時間 21 分** — 3 時間ルール内)
- 内容テーマ: #106 あなた向けカリキュラムの手動カスタマイズ。重点音変化タイプ (最大 3・選択順保持) と
  難易度 (ぜんぶ/初級/中級) を「あなた向けカリキュラム」シートの「調整する」から手動再編成できるようにした。
  保存スキーマ後方互換 (旧データ・不正値は自動おすすめへフォールバック)・自動推薦 (ゼロ設定) の既定動作は維持。

### 経路の記録

| 手順 | 経路 | 時刻 (JST) | 結果 |
|---|---|---|---|
| 実装 | omp (Oh My Pi / zai/glm-5.3-flash) に仕様書を渡して実装 → Orchestrator が検収 | 08:30–08:58 | curriculum.ts / userStore.ts / CurriculumSheet / CurriculumCustomizeSheet (新規) / index.tsx / analyticsStore。検収時に実画面検証で「連続タップ時に古い state を基に選択が欠落する競合」を発見 → `setCurriculumCustom` を関数型更新に修正 |
| PR | PR #116 (feat + v1.3 バージョン準備 + UI 証跡) → squash マージ `e39f2a4` | 09:59–10:20 | cubic: NEUTRAL (指摘なし)。CodeRabbit: Major 1 + Minor 3 → **Major** (難易度のみ変更時に診断重点タイプが失われる) と **Minor 2 件** (ロード完了前のリセットがディスクの古い値で復活 / 審査メモのデータ収集文面) を実コード検証のうえ修正 (`35d54fd`)、**Minor 1 件** (レベル内全完了時の「今日の1本」フォールバック) は自動推薦と同一の既存既定動作のため対応見送りをスレッドで回答して解決 |
| CI | self-hosted のみ (runs-on 変更なし) | — | **実行なし** — ランナー m1-eng-listening が offline (08:15 時点で ping 100% loss 継続) のため workflow は起動せず。ローカル検証 (`npm run lint` / `npm run typecheck` / シミュレータ実画面・XCUITest による実導線 4 ラン = Light/Dark × 2 テストを全て PASS) を証拠としてマージ判断。ホステッドランナーには切替えない (運用ルール) |
| upload | **m4 (Mac mini) ローカル** `appstore-upload.sh --version 1.3 --build 10 --upload` | 10:26:44 | **アップロード成功** (altool "UPLOAD SUCCEEDED with no errors")。**Delivery UUID `0c41c821-1a3a-47f6-9200-769764f80408`** (ASC uploadedDate 10:28:06 JST)。アーカイブ検証 OK: version=1.3 build=10 |
| VALID 確認 | ASC API (builds) | 10:38 | **build 10 = VALID** |
| 暗号申告 | ASC API PATCH | 10:38 | `usesNonExemptEncryption = false` を build 10 に事前適用 (v1.1/v1.2 の submit 検証必須指摘を前倒しで解消。今回は 1 回目の submit で成功) |
| apply | ローカル asc-submit run (run `20261125-103531-3b6c`) | 10:35–10:36 | version 1.3 作成 (`d6a22f4b-bea5-4fc6-a8db-477614ab9d68`) + build 10 割当 + メタデータ (What's New ja / 説明 / キーワード / サブタイトル / 審査メモ / phased release) 反映 |
| submit | ローカル asc-submit submit | 10:36:17 | **提出成功** (reviewSubmission `2e34e758-079f-4067-9139-1072f089e789`, IOS) |
| status | ローカル asc-submit status | 10:37 | **version 1.3 = WAITING_FOR_REVIEW** / releaseType AFTER_APPROVAL |

- **upload 経路: m4 ローカル** — m1 ランナー offline 継続のため v1.2 と同じく当初から m4 ローカル経路
  (`scripts/release/appstore-upload.sh`、GUI セッション直実行・LaunchAgent ブートストラップ不要・
  incremental derived data でアーカイブ約 3 分)。**apply / submit 経路: m4 ローカル asc-submit**
  (`~/dev/asc-submit` pinned・ローカル鍵 `AuthKey_8HM846FQ5Z.p8`)。ワークフローの upload/apply/submit は未使用
- サブスクリプション (Premium Annual / Monthly) とグループは同時提出対象外 — v1.3 は IAP の価格・メタデータ変更を含まない (v1.1/v1.2 と同じ判断)

### 提出前ゲートの結果

- **最終バイナリ NS*UsageDescription 監査** (docs/operations.md §1.2、アーカイブ済み `.app` Info.plist で全件列挙):
  - `NSMicrophoneUsageDescription` =
    「シャドーイング練習であなたの発音を録音し、この端末の中でお手本の音声と聞き比べるために使用します。録音した音声が外部に送信されることはありません。」
    — 確定文を維持 (スクリプトの用途文字列ゲート `[4/7]` PASS)
  - `NSLocalNetworkUsageDescription` =
    "Expo Dev Launcher uses the local network to discover and connect to development servers running on your computer."
    — expo-dev-client の既定文。**v1.1 build 8 / v1.2 build 9 と同一条件** (v1.2 提出以降 app.config.ts / package.json / lockfile 無変更で prebuild 出力は決定論的) であり v1.1・v1.2 はこの文字列のまま審査通過・公開済み
  - 上記 2 件のみ (それ以外の NS*UsageDescription は無し)
  - 同梱 Watch バンドル (`app.app/Watch/watch.app`): NS*UsageDescription 0 件・`CFBundleIconName = AppIcon` 維持
    (v1.1 の ITMS-90713 対策が生きていること)・`WKCompanionAppBundleIdentifier = com.takezou.englistening`・
    CFBundleShortVersionString 1.3 を確認 (v1.1 の ITMS-90362 対策後の upload は今回も ITMS 警告なし)
- **spec**: `dist/appstore/release-1.3.json` (version 1.3 / build 10 / AFTER_APPROVAL / phasedRelease false / What's New ja) — validate PASS
- **UI ルールブック** (PR #116 に §3 点検数値を記載): P1 プライマリ 0 / P2 ブロック 4 / P5 内部文字列 0 /
  P6 セクション見出し 0 (インラインフィールドラベル) / P7 既存部品のみ。Light/Dark 実画面 10 枚を
  `docs/evidence/v1.3-curriculum-customize/` に格納 (curriculum-sheet / customize-sheet / customize-applied /
  home-todays-lesson-linked / curriculum-customized-persisted × Light/Dark)
- **W7 / W8**: W7 = 上記 Light/Dark 10 枚で視認性確認。W8 (診断設問の全問目視) = 今回は onboarding・診断関連の diff ゼロのため v1.2 の全問目視結果を引き継ぎ
- watch スクリーンショット: v1.2 で ASC に登録済みの実物を引き継ぎ (watch バンドルの内容変更なし・新規取得不要)

### 備考

- omp (Oh My Pi) 実装時のモデル指定は `--model zai/glm-5.3-flash` (設定済み既定。非 TTY では既定ロールが読まれないため明示指定)
- シミュレータ実画面検証は XCUITest probe (一時物・ios/ ごと git 管理外) でナビゲーションし、
  xcresult の attachment を `xcrun xcresulttool export attachments` で書き出して証跡化した

## v1.2 (build 9) — 2026-11-25

- セッション開始: 2026-11-25 00:36 JST / **審査提出 (WAITING_FOR_REVIEW 確認): 01:33 JST**
  (所要 **57 分** — 3 時間ルール内)
- 内容テーマ: #104 希少音変化タイプ (同化・侵入・弱形) のレッスン 3 本追加 (全 12 → 全 15)。

### 経路の記録

| 手順 | 経路 | 時刻 (JST) | 結果 |
|---|---|---|---|
| コンテンツ生成 | tools/content パイプライン (Gemini 台本 → Neural2 TTS → アライメント) | 00:42–00:45 | 3 本とも GATE PASS。audit 新規 0 件 (既存 12 本の既存分 10 件は v1.1 と同一ベースライン) |
| PR | PR #114 (コード + アセット + バージョン準備) → squash マージ `ac19d30` | 00:50–01:11 | CodeRabbit 指摘 2 件 (同化の誤注釈・同一トークンの矛盾注釈) を実コード検証のうえ修正済み。cubic は投稿なし (直近 docs-only PR 同様) |
| upload | **m4 (Mac mini) ローカル** `appstore-upload.sh --version 1.2 --build 9 --upload` | 01:11 | 01:15 アップロード成功 (altool "No errors uploading archive")。**Delivery UUID 6224927e-c357-4b1f-82eb-fb28548c7c1b** |
| VALID 確認 | ASC API (builds) | 01:30 | **build 9 = VALID** (uploaded 2026-11-24T08:16:21-08:00 = 01:16 JST) |
| apply | ローカル asc-submit run (run 20261125-013134-cbfc) | 01:31 | version 1.2 作成 (`16d996ee-…`) + build 9 割当 + メタデータ (What's New ja / 説明 / キーワード / サブタイトル / 審査メモ) 反映 |
| submit | ローカル asc-submit submit | 01:32 | 1 回目は `usesNonExemptEncryption` 必須指摘 → build 9 へ API PATCH (false) → **2 回目で提出成功** |
| status | ローカル asc-submit status | 01:33 | **version 1.2 = WAITING_FOR_REVIEW** / releaseType AFTER_APPROVAL |

- **upload 経路: m4 ローカル** — m1 ランナー (m1-eng-listening) が offline でワークフロー dispatch が queue から進まなかったため、当初から m4 ローカル経路を使用 (v1.1 の申し送りどおり archive を伴う upload は m4 が安全)。GUI セッション (Aqua) 直実行で LaunchAgent ブートストラップ不要だった。**incremental derived data によりアーカイブは約 3 分** (v1.1 の 60 分超えから大幅短縮)
- **apply / submit 経路: m4 ローカル asc-submit** — m1 ランナー offline のため docs/appstore/README.md「手元の Mac から実行する場合 (フォールバック)」の手順を使用 (`~/dev/asc-submit` は workflow と同一 pinned SHA `51e10ad`。ローカル鍵 `AuthKey_8HM846FQ5Z.p8`)。spec は `dist/appstore/release-1.2.json` (validate PASS)。ワークフローの apply/submit は未使用 (ランナー復旧待ちではなくローカルで完結)
- `usesNonExemptEncryption = false` を build 9 に設定 (v1.1 同様、ASC submit 検証の必須指摘対応)
- サブスクリプション (Premium Annual / Monthly) とグループは同時提出対象外 — v1.2 は IAP の価格・メタデータ変更を含まない (v1.1 と同じ判断)

### 提出前ゲートの結果

- **最終バイナリ NS*UsageDescription 監査** (docs/operations.md §1.2、アーカイブ済み .app Info.plist で実施):
  - `NSMicrophoneUsageDescription` =
    「シャドーイング練習であなたの発音を録音し、この端末の中でお手本の音声と聞き比べるために使用します。録音した音声が外部に送信されることはありません。」
    — 確定文を維持 (スクリプトのゲート `[4/7]` + アーカイブ検証の両方で PASS)
  - `NSLocalNetworkUsageDescription` =
    "Expo Dev Launcher uses the local network to discover and connect to development servers running on your computer."
    — expo-dev-client の既定文。**v1.1 build 8 と同一条件** (v1.1 提出コミット `26c052c` から app.config.ts / package.json / lockfile は無変更で、prebuild 出力は決定論的) であり v1.1 はこの文字列のまま審査通過・公開済み。v1.1 記録の「その他の NS*UsageDescription は無し」は不正確だった (監査方法を今回から全件列挙に修正)
  - 上記 2 件のみ (それ以外の NS*UsageDescription は無し)
- **追加レッスンの音声・台本・アライメントの整合**: 3 本とも `check_voice_consistency.py` GATE PASS (F0 偏差 ≤ 15% / 話速偏差 ≤ 25%)。`audit_word_timings.py` は新規 3 本 0 件。文タイミング連続性 OK。`configHash` は既存 12 本と同一 (`1b1725b9a69efe25`)。Watch 同期 30 ファイル (= 15 レッスン × 2)
- Watch 単体再生: `targets/watch/Lessons/` へ 3 本追加 + `LocalPlayback.swift` の `LessonLibrary.orderedIds` に追加 (iPhone カタログと同順)
- TTS 使用文字数: 3 レッスン合計 1,485 文字 / 当月累計 9,958 文字 (**上限 900,000 文字の 1.1%**、Neural2 のみ・構成不変)
- spec: `dist/appstore/release-1.2.json` (version 1.2 / build 9 / AFTER_APPROVAL / phasedRelease false / What's New ja 3 行) — validate PASS

### 教訓 (次回改善)

- m1 ランナーは夜間 offline のことがある。提出セッションの apply / submit はランナー状態を最初に確認し、offline なら早めにローカル asc-submit フォールバックへ切り替える (今回の 57 分はこの即断で成立)
- ASC API の builds 一覧で `filter[buildNumber]` は使えない (`PARAMETER_ERROR`)。`filter[app]` + `sort=-uploadedDate` で確認する
- derived data を残しておくとアーカイブが数分に短縮される。upload スクリプトは `--clean` が prebuild のみで derived data は消さないため、連続リリースではこのまま運用してよい

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
