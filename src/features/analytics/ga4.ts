/**
 * GA4 (Firebase Analytics) への送信ラッパー (計測計画 v2)。
 *
 * - ネイティブモジュール (@react-native-firebase/analytics) が使えない環境
 *   (Expo Go / Web / ネイティブ未リンクのビルド) では安全に no-op になる。
 * - 送信失敗がアプリ本体や端末内ログ (analyticsStore) に影響しないよう、
 *   例外はすべてここで吸収する。
 * - GA4 のパラメータ名は snake_case が前提のため、送信時にキー名を
 *   camelCase → snake_case へ正規化する (例: lessonId → lesson_id)。
 *   端末内ログ (analyticsStore) の形式は変更しない。
 * - 計測設計の正は docs/metrics.md。
 */

type Ga4Params = Record<string, string | number>;
type AnalyticsPayload = Record<string, string | number | boolean>;
type Ga4UserPropertyValue = string | number | boolean | null;

interface Ga4Analytics {
  logEvent: (name: string, params?: Ga4Params) => void;
  logScreenView: (screenName: string) => void;
  setUserProperties: (props: Record<string, string | null>) => void;
  setUserId: (id: string | null) => void;
}

let cached: Ga4Analytics | null | undefined;

/** ネイティブ呼び出しの戻り値 (Promise) の失敗を握りつぶす */
function swallow(result: unknown): void {
  if (
    result !== null &&
    typeof result === 'object' &&
    typeof (result as Promise<unknown>).catch === 'function'
  ) {
    void (result as Promise<unknown>).catch(() => {});
  }
}

function loadGa4(): Ga4Analytics | null {
  if (cached !== undefined) {
    return cached;
  }
  try {
    // ネイティブ未リンク環境でも読み込み自体で落とさないよう遅延 require する
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@react-native-firebase/analytics') as {
      getAnalytics?: () => unknown;
      logEvent?: (instance: unknown, name: string, params?: Ga4Params) => unknown;
      logScreenView?: (
        instance: unknown,
        params: { screen_name: string; screen_class: string }
      ) => unknown;
      setUserProperties?: (
        instance: unknown,
        props: Record<string, string | null>
      ) => unknown;
      setUserId?: (instance: unknown, id: string | null) => unknown;
    };
    if (
      typeof mod.getAnalytics !== 'function' ||
      typeof mod.logEvent !== 'function' ||
      typeof mod.logScreenView !== 'function' ||
      typeof mod.setUserProperties !== 'function' ||
      typeof mod.setUserId !== 'function'
    ) {
      cached = null;
      return cached;
    }
    const instance = mod.getAnalytics();
    const logEventFn = mod.logEvent;
    const logScreenViewFn = mod.logScreenView;
    const setUserPropertiesFn = mod.setUserProperties;
    const setUserIdFn = mod.setUserId;
    cached = {
      logEvent: (name, params) => {
        swallow(logEventFn(instance, name, params));
      },
      logScreenView: (screenName) => {
        swallow(
          logScreenViewFn(instance, {
            screen_name: screenName,
            screen_class: screenName,
          })
        );
      },
      setUserProperties: (props) => {
        swallow(setUserPropertiesFn(instance, props));
      },
      setUserId: (id) => {
        swallow(setUserIdFn(instance, id));
      },
    };
  } catch {
    cached = null;
  }
  return cached;
}

/** camelCase のキー名を GA4 前提の snake_case に寄せる (lessonId → lesson_id) */
function toSnakeCase(key: string): string {
  return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

/** payload を GA4 のパラメータ形式 (string | number のみ・snake_case キー) に寄せる */
function toGa4Params(payload?: AnalyticsPayload): Ga4Params | undefined {
  if (!payload) {
    return undefined;
  }
  const out: Ga4Params = {};
  for (const [key, value] of Object.entries(payload)) {
    out[toSnakeCase(key)] =
      typeof value === 'boolean' ? (value ? 'true' : 'false') : value;
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

/** 画面遷移を GA4 の screen_view として送る (ScreenViewTracker から呼ばれる) */
export function logScreenView(screenName: string): void {
  try {
    const ga4 = loadGa4();
    if (!ga4) {
      return;
    }
    ga4.logScreenView(screenName);
  } catch (e) {
    if (__DEV__) {
      console.warn('GA4 screen view failed:', e);
    }
  }
}

/**
 * GA4 のユーザープロパティを設定する。値は文字列化され、null は削除。
 * プロパティ名は GA4 コンソールのカスタム定義と一致させること (docs/metrics.md)。
 */
export function setGa4UserProperties(
  props: Record<string, Ga4UserPropertyValue>
): void {
  try {
    const ga4 = loadGa4();
    if (!ga4) {
      return;
    }
    const out: Record<string, string | null> = {};
    for (const [key, value] of Object.entries(props)) {
      out[key] =
        value === null
          ? null
          : typeof value === 'boolean'
            ? value
              ? 'true'
              : 'false'
            : String(value);
    }
    ga4.setUserProperties(out);
  } catch (e) {
    if (__DEV__) {
      console.warn('GA4 setUserProperties failed:', e);
    }
  }
}

/** GA4 のユーザー ID を設定する (RevenueCat の匿名 appUserID を使う。個人情報は渡さない) */
export function setGa4UserId(id: string | null): void {
  try {
    const ga4 = loadGa4();
    if (!ga4) {
      return;
    }
    ga4.setUserId(id);
  } catch (e) {
    if (__DEV__) {
      console.warn('GA4 setUserId failed:', e);
    }
  }
}
