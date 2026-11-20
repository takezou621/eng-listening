# EAS production ビルド前提チェックリスト

> ⚠ **このチェックリストは現時点の実施状況の記録です。** チェック済み (✅) の項目はコード側で
> 完了しているもの、未実施 (⬜) の項目は Expo / ASC アカウントへの対外操作を伴うため
> GM・オーナー側の手順で別途実施するものです。本ドキュメントの作成時点では対外操作は
> 実行していません (プロンプトの指示どおり)。

## 1. コード側の準備 (✅ 完了)

| 項目 | 状態 | 備考 |
|---|---|---|
| 表示名・バージョン (src/config/appConfig.json) | ✅ | appName「ミミトレ」/ version 1.0.0。slug / scheme / bundleIdentifier は変更なし |
| expo config での反映確認 | ✅ | `npx expo config --type public` で name「ミミトレ」/ version「1.0.0」を確認 (PR 本文記載) |
| 法務ドラフト (docs/legal/) | ✅ | プライバシーポリシー / 利用規約 / 特商法表記のドラフト。**プレースホルダ確定は未実施** |
| ストア掲載文ドラフト (docs/store/listing-ja.md) | ✅ | 表示名・サブタイトル案・説明文・キーワード案・スクリーンショット計画 |
| 課金コード基盤 (features/billing/) | ✅ | RevenueCat ラッパー / ペイウォール / エンタイトルメントゲート。実商品なしでフォールバック動作 |
| 分析イベントの端末内ログ | ✅ | features/analytics/。外部送信なし |

## 2. EAS プロジェクト設定 (⬜ 未実施)

| 手順 | 状態 | 内容 |
|---|---|---|
| 2-1. `eas init` の実行 | ⬜ | Expo アカウントでログインし、プロジェクトを EAS に登録する |
| 2-2. projectId の手動設定 | ⬜ | `eas init` は `app.config.ts` (オブジェクト形式) に自動書き込みしないため、**取得した UUID を `extra.eas.projectId` に手動で記入する** (docs/dev-setup.md §5 の手順どおり) |
| 2-3. 反映確認 | ⬜ | `npx expo config --type public` で `extra.eas.projectId` に UUID が入っていることを確認 |

## 3. Apple Developer 結合 (⬜ 未実施)

| 手順 | 状態 | 内容 |
|---|---|---|
| 3-1. Apple Developer Program への参加 | ⬜ | オーナーの個人アカウント (年額 ¥12,900) |
| 3-2. App ID / 証明書の確認 | ⬜ | `com.takezou.englistening` (appConfig 設定値と一致させる)。EAS が証明書を自動管理する設定を推奨 |
| 3-3. ASC アプリレコードの作成 | ⬜ | 表示名「ミミトレ - 英語の音が見える」、バンドル ID `com.takezou.englistening`、SKU 任意。**表示名はオーナー確定** |
| 3-4. RevenueCat との結合 | ⬜ | RevenueCat プロジェクト作成、ASC アプリの In-App Purchase Key を RevenueCat に登録 |

## 4. RevenueCat 課金設定 (⬜ 未実施)

| 手順 | 状態 | 内容 |
|---|---|---|
| 4-1. Entitlement の作成 | ⬜ | Entitlement ID `premium` (src/features/billing/config.ts の ENTITLEMENT_ID と一致させる) |
| 4-2. 商品の作成 | ⬜ | 月額 ¥680 / 年額 ¥4,800 (年額は 7 日間無料トライアル)。**商品 ID は config.ts の PRODUCT_IDS プレースホルダを差し替える** |
| 4-3. Offering への紐づけ | ⬜ | current Offering に月額・年額パッケージを追加 (ペイウォールが getOfferings で取得) |
| 4-4. API キーの設定 | ⬜ | RevenueCat の公開 API キーを `EXPO_PUBLIC_REVENUECAT_API_KEY` に設定 (コードに埋め込まない) |

## 5. production プロファイルでのビルド (⬜ 未実施)

| 手順 | 状態 | 内容 |
|---|---|---|
| 5-1. eas.json の production プロファイル確認 | ⬜ | auto-increment / distribution: store を推奨 |
| 5-2. `eas build --platform ios --profile production` | ⬜ | 対外操作。ビルドには RevenueCat のネイティブ SDK が含まれる (現開発クライアントには未同梱) |
| 5-3. ビルド成果物の動作確認 | ⬜ | TestFlight または実機にインストールし、購入フローまで確認 |

## 6. TestFlight (⬜ 未実施)

| 手順 | 状態 | 内容 |
|---|---|---|
| 6-1. `eas submit --platform ios` | ⬜ | ビルドを TestFlight へアップロード (ASC API キーが必要) |
| 6-2. 内部テスターでの検証 | ⬜ | 診断 → レッスン再生 → 購入 (Sandbox) → 復元 の一連を確認 |
| 6-3. ストア審査への提出 | ⬜ | 掲載文・スクリーンショット (docs/store/listing-ja.md の計画) を入力して提出 |

## 7. リリース後の確認 (参考)

- 分析イベント (app_first_open / onboarding_completed / lesson_completed / paywall_viewed / purchase_completed) は端末内ログのみ。外部送信は別途 GM が判断する (Issue #21 の送信基盤)
- Issue #17/#18/#19 は**実商品設定が未了のため開いたまま**にする (コード側完了でもクローズしない)
- Issue #15/#22 の法務プレースホルダも確定後まで開いたまま
