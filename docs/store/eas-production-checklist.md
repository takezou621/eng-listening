> 注意: 本書は EAS クラウドビルド経路の旧資料です。現在は EAS を使わず、ローカルアーカイブ＋ASC API アップロードが正規経路です。手順は docs/operations.md §1 を参照してください。

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
| 3-1. Apple Developer Program の契約状態確認 | ⬜ | オーナーは参加済み (Paid Applications Agreement は 2026-11-08 に承諾済み)。membership の有効期限と、**Paid Apps Agreement が有効 (銀行・税務情報の登録完了)** であることを developer.apple.com の Agreements, Tax, and Banking で確認する。年間会費は 99 USD または地域別の同等額 (登録・更新時に現地通貨価格が表示されるため、その額を確認) |
| 3-2. App ID / 証明書の確認 | ⬜ | `com.takezou.englistening` (appConfig 設定値と一致させる)。EAS が証明書を自動管理する設定を推奨 |
| 3-3. ASC アプリレコードの作成 | ⬜ | 表示名「ミミトレ - 英語の音が見える」、バンドル ID `com.takezou.englistening`、SKU 任意。**表示名はオーナー確定** |
| 3-4. RevenueCat との結合 | ⬜ | RevenueCat プロジェクト作成、ASC アプリの In-App Purchase Key を RevenueCat に登録 |

## 4. RevenueCat 課金設定 (⬜ 未実施)

| 手順 | 状態 | 内容 |
|---|---|---|
| 4-1. Entitlement の作成 | ⬜ | Entitlement ID `premium` (src/features/billing/config.ts の ENTITLEMENT_ID と一致させる) |
| 4-2. ASC でサブスクリプション商品の作成 | ⬜ | 月額 ¥680 / 年額 ¥4,800 (年額は 7 日間無料トライアル)。同一サブスクリプショングループに作成する |
| 4-3. **両商品を Entitlement `premium` に紐づけ** | ⬜ | RevenueCat の Entitlement 画面で、月額・年額の**両方の商品を Attach** する。**Offering への追加だけでは購入しても entitlements.active.premium が有効にならず、購入者をプレミアム扱いできない** (アプリの checkEntitlement が entitlements.active.premium を参照するため必須) |
| 4-4. Offering への追加 | ⬜ | current Offering に月額・年額パッケージを追加 (ペイウォールの getOfferings で取得) |
| 4-5. 公開 API キーの設定 (ローカル) | ⬜ | RevenueCat の公開 API キーをローカルの `.env` に `EXPO_PUBLIC_REVENUECAT_API_KEY=...` として設定 (コードに埋め込まない) |
| 4-6. **公開 API キーを EAS の production 環境に設定** | ⬜ | ローカルの `.env` は Git 管理対象外のため EAS のクラウドビルドに含まれない。現行 EAS CLI では `eas env:set --name EXPO_PUBLIC_REVENUECAT_API_KEY --value ... --environment production` で production 環境に登録する (`eas secret:create --scope ...` は production 環境の変数登録には使えない)。**未設定の場合、production ビルドのペイウォールは購入不可のまま表示される** (フォールバック動作)。なお、production 環境の値をビルドに渡すには eas.json の production プロファイルに `environment: "production"` の割り当てが必要 (手順 5-1) |
| 4-7. config.ts の PRODUCT_IDS について | — | **コードでは未使用** (購入用 ID は getOfferings() の current.monthly/annual.product.identifier から動的に取得する)。プレースホルダ定義として保持しているが、商品設定は 4-2〜4-4 の RevenueCat / ASC 側で完結する |

## 5. production プロファイルでのビルド (⬜ 未実施)

| 手順 | 状態 | 内容 |
|---|---|---|
| 5-1. eas.json の production プロファイル設定 | ⬜ | 現在の eas.json には environment と distribution が未設定のため、**production プロファイルへ `environment: "production"` を割り当て (4-6 で登録した変数がビルドに渡る)、`distribution: "store"` を設定する**。increment は auto-increment を推奨。※ eas.json 自体の変更は別作業 (オーナー承認後) |
| 5-2. `eas build --platform ios --profile production` | ⬜ | 対外操作。ビルドには RevenueCat のネイティブ SDK が含まれる (現開発クライアントには未同梱) |
| 5-3. ビルド成果物の動作確認 | ⬜ | TestFlight または実機にインストールし、購入フローまで確認 |

## 6. TestFlight (⬜ 未実施)

| 手順 | 状態 | 内容 |
|---|---|---|
| 6-1. `eas submit --platform ios` | ⬜ | ビルドを TestFlight へアップロード (ASC API キーが必要) |
| 6-2. 内部テスターでの検証 | ⬜ | 診断 → レッスン再生 → 購入 (Sandbox) → 復元 の一連を確認 |
| 6-3. **初回のサブスクリプション商品を審査へ追加** | ⬜ | アプリ版の提出だけでは月額・年額のサブスクリプション商品は審査されない。ASC の提出ページで**アプリ版と同じ提出に、初回の月額・年額サブスクリプション (とサブスクリプショングループ) を追加**する |
| 6-4. ストア審査への提出 | ⬜ | 掲載文・スクリーンショット (docs/store/listing-ja.md の計画) を入力して提出 |

## 7. リリース後の確認 (参考)

- 分析イベント (app_first_open / onboarding_completed / lesson_completed / paywall_viewed / purchase_completed) は端末内ログのみ。外部送信は別途 GM が判断する (Issue #21 の送信基盤)
- Issue #17/#18/#19 は**実商品設定が未了のため開いたまま**にする (コード側完了でもクローズしない)
- Issue #15/#22 の法務プレースホルダも確定後まで開いたまま
