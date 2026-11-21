# ミミトレ 運用手順書

最終更新: 2026-11-21（v1.0.0）

日常運用とリリース作業の手順をまとめたものです。設計は `docs/architecture.md`、計測の定義は `docs/metrics.md`、コンテンツ生成は `docs/content-pipeline.md` を参照してください。

## 1. リリース手順（iOS）

EAS クラウドビルドは使いません（Expo アカウントを持たないため）。Mac mini 上のローカルアーカイブ＋ App Store Connect（ASC）API アップロードが正規経路です。

1. `main` がクリーンで `npm run lint` と `npm run typecheck` が通ることを確認する。
2. バージョン／ビルド番号を決める。バージョンは `src/config/appConfig.json` が単一ソース。ビルド番号は appConfig.json に項目がないため、prebuild で生成した iOS プロジェクト側（CURRENT_PROJECT_VERSION）で提出ごとに +1 する（初回提出は 1）。
3. `.env` に `EXPO_PUBLIC_REVENUECAT_API_KEY`（RevenueCat の公開キー）が設定されていることを確認する（値は表示・記録しない）。
4. `npx expo prebuild --platform ios` → `pod install`（`ios/` 内）。
5. `xcodebuild archive`（自動署名、`-allowProvisioningUpdates` と ASC API キー認証を付ける）。署名で詰まった場合は証明書を削除・再発行せず、エラー文をそのまま記録して止まる。
6. App Store 配布用に IPA を書き出し、ASC API キー認証でアップロードする（eyechecker の asc-submit と同じ方式。キー: `~/.appstoreconnect/AuthKey_8HM846FQ5Z.p8`、環境変数は `~/.appstoreconnect/eyechecker-local-upload.env`）。
7. ASC API で builds を照会し、対象ビルドが `VALID` になることを確認する。
8. ASC でメタデータ（`docs/store/listing-ja.md` が正）とスクリーンショット（`docs/store/screenshots/`）をそろえ、ビルドとサブスクリプション（年額・月額）をバージョンにひも付けて審査提出する。

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

- GitHub Actions のホステッドランナーは使わない（クォータ制約）。CI が必要な作業はローカルで実行する。
- ASC のアプリレコード作成は API 不可で Web UI が必要（作成済み: アプリ ID 6837503600、SKU mimitore-ios）。
- `docs/store/eas-production-checklist.md` は EAS 経路の旧資料。現在の正規経路は本書 §1。
