# ミミトレ 運用手順書

最終更新: 2026-11-24（リリースの正規経路を GitHub Actions（m1 ランナー）+ asc-submit に変更）

日常運用とリリース作業の手順をまとめたものです。設計は `docs/architecture.md`、計測の定義は `docs/metrics.md`、コンテンツ生成は `docs/content-pipeline.md` を参照してください。

## 1. リリース手順（iOS）

EAS クラウドビルドは使いません（Expo アカウントを持たないため）。**正規経路は GitHub Actions（m1 ランナー）+ asc-submit** です（eyechecker / kilde と同じ仕組み。構成・初回セットアップは `docs/appstore/README.md`）。ランナーが使えないときのフォールバックとして、Mac mini でのローカル手順（§1.0.1）が残っています。

**提出前ゲート（必須）**: 審査提出・TestFlight 配信の前に、(1) 全画面をライトモードとダークモードの両方で実画面撮影して文字の視認性を検証し、(2) 初回診断を含む設問コンテンツを全問通しで確認する（正解が設問文に含まれていないこと、選択肢の位置が固定されていないこと）。根拠ルールは `docs/ui-design-rules.md` の W7 / W8。

1. `main` がクリーンで `npm run lint` と `npm run typecheck` が通ることを確認する。
2. バージョンを `src/config/appConfig.json` で決め、CHANGELOG と What's New（`docs/appstore/metadata-ja.md` に `## What's New (x.y)` セクションを追加。無いと spec 生成が失敗する）を更新する。
3. workflow `App Store` を `mode=upload`、`version` と `build`（前回提出より大きい整数）を指定して実行する。`scripts/release/appstore-upload.sh` が npm ci → expo prebuild → 用途文字列ゲート（§1.2）→ pod install → アーカイブ → クラウド署名 → ASC アップロードまで行う。**審査は始まらない**。
4. ASC API で builds を照会し、対象ビルドが `VALID` になることを確認する（数分）。
5. `mode=apply`（version と build を指定）でメタデータ（`docs/appstore/` 配下が正）とビルド割当てを反映する。**審査への提出はしない**。反映結果は `mode=status` か ASC の画面で裏取りする。
6. `mode=submit` で審査提出する。dispatch を手で押すことが提出のゲート。
7. 提出後はバージョン・両サブスクリプション・グループの全てが `WAITING_FOR_REVIEW` であることを API で確認する（バージョンだけ提出された状態にしない）。サブスクリプションの提出アイテムの扱いは `docs/appstore/README.md`「メモ」を参照。

### 1.0.1 フォールバック: Mac mini ローカルからの手動リリース

GitHub Actions のランナーが使えないとき（ランナー停止・ネットワーク障害など）は、次のローカル手順で同じ経路を再現する。

1. `main` がクリーンで `npm run lint` と `npm run typecheck` が通ることを確認する。
2. バージョン／ビルド番号を決める。バージョンは `src/config/appConfig.json` が単一ソース。ビルド番号の実体は `ios/app/Info.plist` のリテラル `CFBundleVersion` で、提出ごとに PlistBuddy で +1 する（CURRENT_PROJECT_VERSION ではない）。アーカイブ後は元の値に戻し、作業ツリーを汚さない。
3. `.env` に `EXPO_PUBLIC_REVENUECAT_API_KEY`（RevenueCat の公開キー）が設定されていることを確認する（値は表示・記録しない）。
4. `npx expo prebuild --platform ios` → `pod install`（`ios/` 内）。
5. `xcodebuild archive`（自動署名、`-allowProvisioningUpdates` と ASC API キー認証を付ける）。SSH セッションからはログインキーチェーンがロックされ codesign が `errSecInternalComponent` で失敗するため、アーカイブは GUI セッションへ bootstrap した一時 LaunchAgent 経由で実行する。xcodebuild には `DEVELOPMENT_TEAM=4B873Q67MK` を渡すこと（prebuild はチームなしでプロジェクトを生成する）。pod install 等は `LANG=en_US.UTF-8` で実行する（ロケールがないと Ruby が日本語アプリ名で落ちる）。署名で詰まった場合は証明書を削除・再発行せず、エラー文をそのまま記録して止まる。
6. App Store 配布用に IPA を書き出し、ASC API キー認証でアップロードする（`scripts/release/appstore-upload.sh --version X --build N --upload` がこの手順を自動化する。キー: `~/.appstoreconnect/AuthKey_8HM846FQ5Z.p8`、環境変数は `~/.appstoreconnect/eyechecker-local-upload.env`）。
7. ASC API で builds を照会し、対象ビルドが `VALID` になることを確認する。
8. ASC でメタデータ（`docs/store/listing-ja-final.md` が正）とスクリーンショット（`docs/store/screenshots/`）をそろえ、ビルドをバージョンにひも付けて審査提出する。審査提出アイテムはサブスクリプション本体ではなく **subscriptionVersion**、グループは **subscriptionGroupVersion** を `reviewSubmissionItems` に追加する（本体 ID で POST すると 409 unknown relationship になる）。バージョン ID は各リソースの `versions` 関係から取得する。提出後はバージョン・両サブスクリプション・グループの全てが `WAITING_FOR_REVIEW` であることを API で確認する（バージョンだけ提出された状態にしない）。

メタデータの反映・提出だけをローカルで行う手順は `docs/appstore/README.md`「手元の Mac から実行する場合」を参照（`asc-submit` を `PYTHONPATH` 経由で直接実行できる）。

### 1.1 iPhone Duo 検証（リリース前ゲート）

折りたたみ iPhone Duo の外側ディスプレイは右端にセンサーバーがあり、右セーフエリア 84pt が報告される。`Screen` は左右のセーフエリアを適用済み（Issue #60）。リリース前に XCUITest で崩れがないことを確認する（この Mac は Simulator の GUI がなく通常のスクリーンショットが真っ黒になるため、検証はアクセシビリティ階層と要素フレームで行う）。

```bash
# ios/ は生成物なので、検証のたびに UI テストターゲットを注入する
export GEM_PATH=/opt/homebrew/Cellar/cocoapods/1.17.0_1/libexec:/opt/homebrew/lib/ruby/gems/4.0.0:/opt/homebrew/Cellar/ruby/4.0.10/lib/ruby/gems/4.0.0:$HOME/.local/share/gem/ruby/4.0.0
ruby tools/duo/inject_uitest.rb
cp tools/duo/DuoSmokeTests.swift ios/appUITests/DuoSmokeTests.swift
xcodebuild test -workspace ios/app.xcworkspace -scheme duo-smoke -configuration Release \
  -destination "platform=iOS Simulator,id=355C05F4-08AE-45D9-9D72-FB45403D0F7C" \
  -derivedDataPath /tmp/el-fixdd
```

- 合格条件: 2 テスト成功 + ログの DUO-EVIDENCE で、カードと再生バーの右端が 366pt（466 − 84 − 16）以内に収まること
- 内側ディスプレイ（開いた状態）はシミュレータではシーンが移らず直接検証できない。レイアウトは同じセーフエリア機構で追従する

### 1.2 用途文字列（パーパス文字列）の提出前監査【必須ゲート】

2026-11-22、v1.0 の審査が Apple の自動チェックでリジェクトされた（NSMicrophoneUsageDescription が Expo のデフォルト文 "Allow $(PRODUCT_NAME) to access your microphone" のままで、用途として不十分と判定）。再発防止として、以下を提出前の必須ゲートとする。

- 提出する全ビルドについて、**最終バイナリ**（.ipa を展開した .app の Info.plist、またはアーカイブ済みアプリの Info.plist）に含まれるすべての `NS*UsageDescription` を一覧化し、文面を確認する。設定ファイル（app.config.ts やプラグイン設定）が正しくても提出可否の判定には使わない。判定は常に最終成果物で行う（W7 の「両テーマ確認」と同じ原則）。
- プラグインやフレームワークのデフォルト文・汎用文（例: "Allow ... to access your ..."、"App needs ... access"）が1つでも残っていたら**提出禁止**。用途文字列は「どの機能で・何のために・データをどう扱うか（外部送信の有無を含む）」を具体的に書く。
- 新しい権限（マイク、カメラ、写真、位置情報、通知、トラッキング等）を追加する PR は、用途文字列の設定を同じ PR に含め、文面を PR 本文に明記する。文面のない権限追加 PR はマージしない。
- この監査は §1 の提出手順の一部であり、実施記録（確認した文字列の一覧）を提出時の報告に含める。
- 2026-11-24 から `scripts/release/appstore-upload.sh` がこのゲートを自動実行する（生成直後の Info.plist とアーカイブ済み .app の Info.plist の両方で、プレースホルダ文を検出したらアーカイブ前に失敗する。マイク用途文は確定文の接頭一致も検査）。ただし自動化の有無にかかわらず、人が文面を読んで確認する義務は残る。

## 2. コンテンツ（レッスン）の追加

1. `tools/content/` のパイプラインでスクリプト生成→ TTS 生成を行う（詳細は `docs/content-pipeline.md`）。
   - TTS は Google Cloud TTS の **Neural2 のみ**。月間 900,000 文字でハードストップ（無料枠 100 万文字を超えない）。
   - 音声の一貫性ゲート（話速のばらつき検査）を PASS させる。
2. 生成物をアプリに同梱し、`src/features/lesson/registry.ts` の CATALOG / BUNDLES に登録する（require パスはリテラルで書く）。
3. 実機／シミュレータで再生と表示を確認し、PR に証跡（スクリーンショット）を添える。

## 3. 課金まわりの変更

| 変更したいこと | 触る場所 |
|---|---|
| 価格 | 実際の課金価格は ASC のサブスクリプション価格（価格変更はユーザー通知ルールに注意）。ただし表示価格は `src/features/billing/config.ts` の `DISPLAY_PRICES` 定数のため、表示を変える場合はコード変更＋再提出が必要 |
| 商品の追加・構成 | ASC で商品作成 → RevenueCat で商品・entitlement `premium`・Offering `default` のパッケージに反映 |
| 無料／プレミアムの境界 | アプリ側は `billingStore` の判定のみ。境界の仕様変更はコード変更＋再提出が必要 |
| RevenueCat の公開キー差し替え | `.env` の `EXPO_PUBLIC_REVENUECAT_API_KEY` を差し替えて再ビルド |

注意: RevenueCat の商品ページで「App Store Connect に接続できない」と表示されることがあるが、ASC 側の商品が審査前だと情報取得できないための表示で、購入検証そのものの失敗ではない。実挙動は TestFlight のサンドボックス購入で確認する。

## 4. 検証の基本（テスト方針）

- 自動テスト基盤（Jest 等）は v1.0 では未導入。変更時の最低ラインは `npm run lint` と `npm run typecheck` の PASS。
- 画面・再生・課金の挙動はシミュレータ／TestFlight 実機で確認し、証跡スクリーンショットを `docs/evidence/` に残す運用としてきた（v1.0 の証跡あり）。
- v1.1 以降の課題: ストア層（進捗・お気に入り）の単体テスト導入を検討する。

## 5. 既知の注意点

- GitHub Actions のホステッドランナーは使わない（クォータ制約）。検証が必要な作業はローカルで実行する。ただし `appstore.yml` だけは **self-hosted ランナー（m1）限定**で実行する（最初の step が `runner.environment` を検査し、ホステッド実行は即座に失敗する）。
- ASC のアプリレコード作成は API 不可で Web UI が必要（作成済み: アプリ ID 6837503600、SKU mimitore-ios）。
- `docs/store/eas-production-checklist.md` は EAS 経路の旧資料。現在の正規経路は本書 §1。


### Apple Watch 同梱レッスンの再同期

Watch アプリは `targets/watch/Lessons/<id>.{json,m4a}` にレッスンのコピーを持つ
(フォルダ同期でバンドルへ取り込まれる)。コンテンツパイプラインで
`assets/lessons/` を再生成したら、次で再同期して結果をコミットすること。

```sh
zsh tools/watch-assets/sync_watch_assets.sh
```

Watch 単体学習の進捗は applicationContext で iPhone に同期される
(未適用セッション一覧 → 適用 → 適用済みIDの ack)。transferUserInfo /
sendMessage は即時配送の補助で、どちらも iPhone 側の ID 重複排除が前提。
