/**
 * 課金設定の定数 (コード側の単一の定義場所)。
 *
 * ⚠ ストア側の実商品は未作成 (GM／オーナーの判断後に App Store Connect で作成)。
 * PRODUCT_IDS はプレースホルダのため、RevenueCat の Offerings からは取得できず、
 * ペイウォールの購入ボタンは無効化される (理由を画面上に表示)。
 *
 * 実商品を設定する際の差し替え手順 (PR 説明にも記載):
 * 1. App Store Connect でアプリレコードとサブスクリプション商品を作成する
 *    (月額: 価格レベル ¥680 相当 / 年額: ¥4,800 相当、年額は 7 日間無料トライアル)
 * 2. RevenueCat ダッシュボードでプロジェクトと Entitlement (premium) を作成し、
 *    商品を紐づける
 * 3. 下記 PRODUCT_IDS を実際の商品 ID に差し替える
 * 4. REVENUECAT_API_KEY を環境変数 (EXPO_PUBLIC_REVENUECAT_API_KEY) に設定する
 * 5. 新しいネイティブモジュールを含む開発ビルドを作り直す
 *    (react-native-purchases はネイティブ SDK を含むため、現行の開発クライアントには
 *     含まれていない。npx expo prebuild / EAS Build での再ビルドが必要)
 */

/** RevenueCat の公開 API キー (環境変数から読み取る。実キーをコードに埋め込まない) */
export const REVENUECAT_API_KEY: string | undefined =
  process.env.EXPO_PUBLIC_REVENUECAT_API_KEY;

/** RevenueCat の Entitlement ID (プレースホルダ) */
export const ENTITLEMENT_ID = 'premium';

/** ストア商品 ID (プレースホルダ。実商品作成後に差し替える) */
export const PRODUCT_IDS = {
  monthly: 'placeholder_englistening_monthly_680',
  annual: 'placeholder_englistening_annual_4800',
} as const;

/** GM 決定の価格表示 (ユーザーへの表示用。実際の課金額はストア設定に従う) */
export const DISPLAY_PRICES = {
  monthlyJa: '月額 ¥680',
  annualJa: '年額 ¥4,800 (7 日間の無料トライアル付き)',
  monthlyEn: '¥680 / month',
  annualEn: '¥4,800 / year (7-day free trial)',
} as const;
