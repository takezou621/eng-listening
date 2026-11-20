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
 * - 実商品が設定され、キーとネイティブビルドが揃った段階で isAvailable が
 *   true になり、ペイウォールの購入ボタンが有効になる
 */

export interface BillingState {
  /** RevenueCat が利用可能 (キー設定済み + ネイティブモジュールあり) */
  isAvailable: boolean;
  /** プレミアムエンタイトルメントを持つか */
  isPremium: boolean;
  /** 初期化・顧客情報取得中 */
  isLoading: boolean;
}

let configured = false;
let available = false;
let premium = false;
const listeners = new Set<() => void>();

/** Purchases モジュール (利用可能な場合のみ non-null) */
type PurchasesModule = {
  configure: (config: { apiKey: string }) => Promise<void> | void;
  addCustomerInfoUpdateListener: (listener: (info: unknown) => void) => void;
  getCustomerInfo: () => Promise<{ entitlements: { active: Record<string, unknown> } }>;
};

let purchases: PurchasesModule | null = null;
try {
  // ネイティブモジュールがこのビルドに含まれていない場合は require が失敗するため
  // no-require-imports ルールを意図的に無効化している (フォールバック動作のため)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  purchases = require('react-native-purchases');
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
  return { isAvailable: available, isPremium: premium, isLoading: !configured && available };
}

/**
 * RevenueCat を初期化する (キーとネイティブモジュールが揃っている場合のみ)。
 * 失敗してもアプリは継続し、無料扱いとなる (クラッシュしないフォールバック)。
 */
export async function initBillingAsync(): Promise<void> {
  if (configured) return;
  configured = true;

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
  } catch (e) {
    console.error('Failed to initialize RevenueCat:', e);
    available = false;
    premium = false;
  }
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

/** 実購入 (または復元) 成功時のコールバック。分析への配線は呼び出し側で行う */
export async function refreshCustomerInfoAsync(): Promise<boolean> {
  if (!available || !purchases) return false;
  try {
    const info = await purchases.getCustomerInfo();
    premium = checkEntitlement(info);
    notify();
    return premium;
  } catch (e) {
    console.error('Failed to refresh customer info:', e);
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
