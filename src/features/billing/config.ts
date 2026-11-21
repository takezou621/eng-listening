/**
 * 課金設定の定数 (コード側の単一の定義場所)。
 *
 * ⚠ ストア側の実商品は未作成 (GM／オーナーの判断後に App Store Connect で作成)。
 * 商品が作成されるまで RevenueCat の Offerings は空のため、
 * ペイウォールの購入ボタンは無効化される (理由を画面上に表示)。
 *
 * 実商品を設定する際の手順 (詳細は docs/store/eas-production-checklist.md):
 * 1. App Store Connect でアプリレコードとサブスクリプション商品を作成する
 *    (月額: 価格レベル ¥680 相当 / 年額: ¥4,800 相当、年額は 7 日間無料トライアル)
 * 2. RevenueCat ダッシュボードでプロジェクトと Entitlement (premium) を作成し、
 *    **両商品を Entitlement に紐づけたうえで** Offering に追加する
 *    (Offering への追加だけでは entitlements.active.premium が有効にならない)
 * 3. REVENUECAT_API_KEY を環境変数 (EXPO_PUBLIC_REVENUECAT_API_KEY) に設定する
 *    (ローカルの .env に加え、EAS の production 環境にも登録する)
 * 4. 新しいネイティブモジュールを含む開発ビルドを作り直す
 *    (react-native-purchases はネイティブ SDK を含むため、現行の開発クライアントには
 *     含まれていない。npx expo prebuild / EAS Build での再ビルドが必要)
 *
 * ※ 下記 PRODUCT_IDS は**コード内では未使用**。購入用の商品 ID は
 *   RevenueCat の getOfferings() が返す current.monthly/annual.product.identifier
 *   (ストア商品 ID) を動的に使用するため、ASC / RevenueCat 側の設定が正しければ
 *   コードの変更は不要。
 */

/** RevenueCat の公開 API キー (環境変数から読み取る。実キーをコードに埋め込まない) */
export const REVENUECAT_API_KEY: string | undefined =
  process.env.EXPO_PUBLIC_REVENUECAT_API_KEY;

/** RevenueCat の Entitlement ID (プレースホルダ) */
export const ENTITLEMENT_ID = 'premium';

/** ストア商品 ID (定義のみ・コードでは未使用。購入用 ID は getOfferings() の product.identifier から取得する) */
export const PRODUCT_IDS = {
  monthly: 'com.takezou.englistening.premium.monthly',
  annual: 'com.takezou.englistening.premium.annual',
} as const;

/** GM 決定の価格表示 (ユーザーへの表示用。実際の課金額はストア設定に従う) */
export const DISPLAY_PRICES = {
  monthlyJa: '月額 ¥680',
  annualJa: '年額 ¥4,800 (7 日間の無料トライアル付き)',
  monthlyEn: '¥680 / month',
  annualEn: '¥4,800 / year (7-day free trial)',
} as const;
