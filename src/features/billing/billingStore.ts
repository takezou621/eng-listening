import { useEffect, useState } from 'react';
import { REVENUECAT_API_KEY, ENTITLEMENT_ID } from './config';

/**
 * RevenueCat 課金基盤のラッパー (Issue #17 コード側) と
 * プレミアム判定の単一の真実 (Issue #19)。
 *
 * 制約とフォールバック:
 * - react-native-purchases はネイティブ SDK を含むため、現行の開発クライアント
 *   (ビルド済みバイナリ) には含まれていない。ネイティブモジュールが存在しない
 *   環境では import も configure も失敗するため、以下のフォールバックで動く:
 *   - isAvailable = false (課金 UI は無効化、無料扱い)
 * - REVENUECAT_API_KEY (EXPO_PUBLIC_REVENUECAT_API_KEY) が未設定の場合も
 *   isAvailable = false とする (実キーをコードに埋め込まない)
 * - 初期化に失敗した場合は configured を false に戻し、次回呼び出しで再試行できる
 */

export interface BillingState {
  /** RevenueCat が利用可能 (キー設定済み + ネイティブモジュールあり + 初期化成功) */
  isAvailable: boolean;
  /** プレミアムエンタイトルメントを持つか */
  isPremium: boolean;
  /** 初期化・顧客情報取得中 */
  isLoading: boolean;
}

/** Offerings 取得結果 */
export interface OfferingsResult {
  /** 購入可能な商品が存在する */
  hasProducts: boolean;
  monthlyProductId: string | null;
  annualProductId: string | null;
}

let configured = false;
let available = false;
let premium = false;
let loading = false;
const listeners = new Set<() => void>();

/** Purchases モジュール (利用可能な場合のみ non-null) */
type PurchasesModule = {
  configure: (config: { apiKey: string }) => Promise<void> | void;
  addCustomerInfoUpdateListener: (listener: (info: unknown) => void) => void;
  getCustomerInfo: () => Promise<{ entitlements: { active: Record<string, unknown> } }>;
  getOfferings: () => Promise<{
    current: {
      monthly: { identifier: string } | null;
      annual: { identifier: string } | null;
    } | null;
  }>;
  purchaseProduct: (productId: string) => Promise<{
    customerInfo: { entitlements: { active: Record<string, unknown> } };
  }>;
  restorePurchases: () => Promise<{
    customerInfo: { entitlements: { active: Record<string, unknown> } };
  }>;
};

let purchases: PurchasesModule | null = null;
try {
  // ネイティブモジュールがこのビルドに含まれていない場合は require が失敗するため
  // no-require-imports ルールを意図的に無効化している (フォールバック動作のため)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('react-native-purchases');
  // RN の interop により default export 配下に実装がある場合に対応する
  purchases = (mod?.default ?? mod) as PurchasesModule;
} catch {
  // ネイティブモジュールがこの開発クライアントに含まれていない場合
  purchases = null;
}

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

function getState(): BillingState {
  return { isAvailable: available, isPremium: premium, isLoading: loading };
}

/**
 * RevenueCat を初期化する (キーとネイティブモジュールが揃っている場合のみ)。
 * 失敗してもアプリは継続し、無料扱いとなる (クラッシュしないフォールバック)。
 * 失敗時は configured を false に戻すため、次回呼び出しで再試行できる。
 */
export async function initBillingAsync(): Promise<void> {
  if (configured || loading) return;
  if (!REVENUECAT_API_KEY) {
    // キー未設定: 課金機能は無効 (無料扱い)
    available = false;
    notify();
    return;
  }
  if (!purchases || typeof purchases.configure !== 'function') {
    // ネイティブモジュールがこのビルドに含まれていない
    available = false;
    notify();
    return;
  }

  loading = true;
  notify();
  try {
    await purchases.configure({ apiKey: REVENUECAT_API_KEY });
    available = true;

    // 顧客情報の更新をリッスン (購入・復元・更新時に発火)
    purchases.addCustomerInfoUpdateListener((info) => {
      premium = checkEntitlement(info);
      notify();
    });

    const info = await purchases.getCustomerInfo();
    premium = checkEntitlement(info);
    configured = true;
  } catch (e) {
    console.error('Failed to initialize RevenueCat:', e);
    available = false;
    premium = false;
  }
  loading = false;
  notify();
}

/** 顧客情報からプレミアムエンタイトルメントを判定する */
function checkEntitlement(info: unknown): boolean {
  try {
    const entitlements = (info as { entitlements?: { active?: Record<string, unknown> } })
      ?.entitlements?.active;
    return Boolean(entitlements && entitlements[ENTITLEMENT_ID]);
  } catch {
    return false;
  }
}

/**
 * Offerings から購入可能な商品を取得する。
 * ストア側で実商品が未作成の場合は hasProducts = false を返す
 * (ペイウォールは購入ボタンを無効化し、その理由を表示する)。
 */
export async function fetchOfferingsAsync(): Promise<OfferingsResult> {
  const empty: OfferingsResult = {
    hasProducts: false,
    monthlyProductId: null,
    annualProductId: null,
  };
  if (!available || !purchases) return empty;
  try {
    const offerings = await purchases.getOfferings();
    const current = offerings?.current ?? null;
    const monthly = current?.monthly?.identifier ?? null;
    const annual = current?.annual?.identifier ?? null;
    return { hasProducts: Boolean(monthly || annual), monthlyProductId: monthly, annualProductId: annual };
  } catch (e) {
    console.error('Failed to fetch offerings:', e);
    return empty;
  }
}

/**
 * 商品を購入する。成功時は true を返す (呼び出し側が purchase_completed を発火する)。
 * ユーザーによるキャンセルは false (エラー扱いにしない)。
 */
export async function purchaseAsync(productId: string): Promise<boolean> {
  if (!available || !purchases) return false;
  try {
    const result = await purchases.purchaseProduct(productId);
    premium = checkEntitlement(result.customerInfo);
    notify();
    return premium;
  } catch (e) {
    // ユーザーキャンセルを含む失敗は false
    console.error('Purchase failed:', e);
    return false;
  }
}

/** 過去の購入を復元する (再インストール・機種変更時)。成功時は true */
export async function restorePurchasesAsync(): Promise<boolean> {
  if (!available || !purchases) return false;
  try {
    const result = await purchases.restorePurchases();
    premium = checkEntitlement(result.customerInfo);
    notify();
    return premium;
  } catch (e) {
    console.error('Restore failed:', e);
    return false;
  }
}

/** プレミアム判定の単一の真実 (Issue #19) */
export function useEntitlement(): BillingState {
  const [state, setState] = useState<BillingState>(getState);

  useEffect(() => {
    const listener = () => setState(getState());
    listeners.add(listener);
    void initBillingAsync();
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return state;
}

/** hook 外から同期的に判定する場合 (例: ゲート処理) */
export function isPremiumSync(): boolean {
  return premium;
}
