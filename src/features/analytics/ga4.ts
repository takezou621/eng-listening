/**
 * GA4 (Firebase Analytics) へのイベント送信ラッパー。
 *
 * - ネイティブモジュール (@react-native-firebase/analytics) が使えない環境
 *   (Expo Go / Web / ネイティブ未リンクのビルド) では安全に no-op になる。
 * - 送信失敗がアプリ本体や端末内ログ (analyticsStore) に影響しないよう、
 *   例外はすべてここで吸収する。
 * - 計測設計の正は docs/metrics.md。
 */

type Ga4Params = Record<string, string | number>;
type AnalyticsPayload = Record<string, string | number | boolean>;

interface Ga4Analytics {
  logEvent: (name: string, params?: Ga4Params) => void;
}

let cached: Ga4Analytics | null | undefined;

function loadGa4(): Ga4Analytics | null {
  if (cached !== undefined) {
    return cached;
  }
  try {
    // ネイティブ未リンク環境でも読み込み自体で落とさないよう遅延 require する
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@react-native-firebase/analytics') as {
      getAnalytics?: () => unknown;
      logEvent?: (instance: unknown, name: string, params?: Ga4Params) => void;
    };
    if (typeof mod.getAnalytics !== 'function' || typeof mod.logEvent !== 'function') {
      cached = null;
      return cached;
    }
    const instance = mod.getAnalytics();
    const logEventFn = mod.logEvent;
    cached = {
      logEvent: (name, params) => {
        logEventFn(instance, name, params);
      },
    };
  } catch {
    cached = null;
  }
  return cached;
}

/** payload を GA4 のパラメータ形式 (string | number のみ) に寄せる */
function toGa4Params(payload?: AnalyticsPayload): Ga4Params | undefined {
  if (!payload) {
    return undefined;
  }
  const out: Ga4Params = {};
  for (const [key, value] of Object.entries(payload)) {
    out[key] = typeof value === 'boolean' ? (value ? 'true' : 'false') : value;
  }
  return out;
}

/**
 * イベントを GA4 にも送る。失敗しても例外は投げない。
 * analyticsStore.logEvent の端末内記録の後に呼ばれる前提。
 */
export function forwardEventToGa4(type: string, payload?: AnalyticsPayload): void {
  try {
    const ga4 = loadGa4();
    if (!ga4) {
      return;
    }
    ga4.logEvent(type, toGa4Params(payload));
  } catch (e) {
    if (__DEV__) {
      console.warn('GA4 forwarding failed:', e);
    }
  }
}
