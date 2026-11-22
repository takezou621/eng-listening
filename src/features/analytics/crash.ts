/**
 * Crashlytics / Performance Monitoring のラッパー。
 *
 * ga4.ts と同じ方針:
 * - ネイティブモジュールが使えない環境 (Expo Go / Web / 未リンク) では no-op。
 * - 例外はすべてここで吸収し、アプリ本体の動作に影響させない。
 *
 * Crashlytics へのレポートは「次回起動時に送信」されるのが Firebase の仕様で、
 * コンソールにダッシュボードが現れるのは初回クラッシュのアップロード後。
 */

type CrashlyticsModule = {
  getCrashlytics?: () => unknown;
  setCrashlyticsCollectionEnabled?: (instance: unknown, enabled: boolean) => unknown;
  recordError?: (instance: unknown, error: Error, jsErrorName?: string) => void;
  log?: (instance: unknown, message: string) => void;
};

let crashMod: CrashlyticsModule | null | undefined;
let crashInstance: unknown = null;

function swallow(result: unknown): void {
  if (
    result !== null &&
    typeof result === 'object' &&
    typeof (result as Promise<unknown>).catch === 'function'
  ) {
    void (result as Promise<unknown>).catch(() => {});
  }
}

function loadCrashlytics(): unknown {
  if (crashMod !== undefined) {
    return crashInstance;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@react-native-firebase/crashlytics') as CrashlyticsModule;
    if (typeof mod.getCrashlytics !== 'function') {
      crashMod = null;
      crashInstance = null;
      return null;
    }
    crashMod = mod;
    crashInstance = mod.getCrashlytics();
  } catch {
    crashMod = null;
    crashInstance = null;
  }
  return crashInstance;
}

/**
 * 非致命的エラーを Crashlytics に記録する。失敗しても例外は投げない。
 * context は Crashlytics のログ行として添付される (個人情報は入れないこと)。
 */
export function recordError(error: unknown, context?: string): void {
  try {
    const instance = loadCrashlytics();
    if (!instance || !crashMod || typeof crashMod.recordError !== 'function') {
      return;
    }
    const err =
      error instanceof Error
        ? error
        : new Error(typeof error === 'string' ? error : 'Unknown error');
    if (context && typeof crashMod.log === 'function') {
      crashMod.log(instance, context);
    }
    crashMod.recordError(instance, err);
  } catch {
    // 記録の失敗でアプリを落とさない
  }
}

type ErrorUtilsShape = {
  getGlobalHandler?: () => ((error: Error, isFatal?: boolean) => void) | undefined;
  setGlobalHandler?: (handler: (error: Error, isFatal?: boolean) => void) => void;
};

function installGlobalErrorHandler(): void {
  try {
    const errorUtils = (
      globalThis as { ErrorUtils?: ErrorUtilsShape }
    ).ErrorUtils;
    if (!errorUtils || typeof errorUtils.setGlobalHandler !== 'function') {
      return;
    }
    const previous =
      typeof errorUtils.getGlobalHandler === 'function'
        ? errorUtils.getGlobalHandler()
        : undefined;
    errorUtils.setGlobalHandler((error, isFatal) => {
      recordError(error, isFatal ? 'fatal_js_error' : 'nonfatal_js_error');
      if (previous) {
        previous(error, isFatal);
      }
    });
  } catch {
    // ハンドラ差し込みの失敗は無視する (既定のハンドラが残る)
  }
}

function initPerf(): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@react-native-firebase/perf') as {
      getPerformance?: () => {
        setPerformanceCollectionEnabled?: (enabled: boolean) => unknown;
      };
    };
    if (typeof mod.getPerformance !== 'function') {
      return;
    }
    const perf = mod.getPerformance();
    if (perf && typeof perf.setPerformanceCollectionEnabled === 'function') {
      swallow(perf.setPerformanceCollectionEnabled(true));
    }
  } catch {
    // Perf が使えない環境では何もしない
  }
}

let initialized = false;

/**
 * アプリ起動時に一度だけ呼ぶ。Crashlytics / Perf の収集を有効化し、
 * JS のグローバルエラーハンドラを Crashlytics 記録付きに差し替える
 * (従来のハンドラにも必ず引き継ぐ)。
 */
export function initCrashReporting(): void {
  if (initialized) {
    return;
  }
  initialized = true;
  try {
    const instance = loadCrashlytics();
    if (
      instance &&
      crashMod &&
      typeof crashMod.setCrashlyticsCollectionEnabled === 'function'
    ) {
      swallow(crashMod.setCrashlyticsCollectionEnabled(instance, true));
    }
  } catch {
    // 有効化の失敗は無視する
  }
  initPerf();
  installGlobalErrorHandler();
}
