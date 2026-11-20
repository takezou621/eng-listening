import { Paths, File } from 'expo-file-system';
import { useEffect, useState } from 'react';

/**
 * 分析イベントの端末内ログ (Issue #21 最小実装)。
 *
 * - イベントは端末内の JSON ファイルにのみ記録し、外部送信は一切しない (v1.0 方針)。
 * - 個人を特定する情報は記録しない。イベントには端末内連番 (seq) とローカル時刻のみ。
 * - 送信基盤 (外部サービス) は GM が別途判断する。現状はデバッグ用途のログ。
 */

const STORAGE_FILE = new File(Paths.document, 'analytics-log.json');

/** 記録できるイベントの種類 */
export type AnalyticsEventType =
  | 'app_first_open'
  | 'onboarding_started'
  | 'onboarding_completed'
  | 'onboarding_skipped'
  | 'lesson_started'
  | 'lesson_completed'
  | 'shadowing_recorded'
  | 'paywall_viewed'
  | 'purchase_completed';

export interface AnalyticsEvent {
  /** 端末内連番 (1 起算) */
  seq: number;
  type: AnalyticsEventType;
  /** ローカル時刻 (ISO 8601) */
  timestamp: string;
  /** イベントごとの追加情報 (レッスン ID・診断結果など。個人情報は含まない) */
  payload?: Record<string, string | number | boolean>;
}

type AnalyticsLog = AnalyticsEvent[];

let cachedLog: AnalyticsLog = [];
let isLoaded = false;
let loadPromise: Promise<void> | null = null;
let canPersist = false;
let saveQueue: Promise<void> = Promise.resolve();
const listeners = new Set<() => void>();

function localIsoTime(): string {
  const d = new Date();
  const pad = (n: number) => `${n}`.padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function parseLog(json: string): AnalyticsLog {
  const parsed: unknown = JSON.parse(json);
  if (!Array.isArray(parsed)) return [];
  const out: AnalyticsLog = [];
  let maxSeq = 0;
  for (const item of parsed) {
    if (typeof item !== 'object' || item === null) continue;
    const r = item as Partial<AnalyticsEvent>;
    if (typeof r.seq !== 'number' || typeof r.type !== 'string' || typeof r.timestamp !== 'string') {
      continue;
    }
    out.push({
      seq: r.seq,
      type: r.type as AnalyticsEventType,
      timestamp: r.timestamp,
      payload: typeof r.payload === 'object' && r.payload !== null ? r.payload : undefined,
    });
    if (r.seq > maxSeq) maxSeq = r.seq;
  }
  return out.sort((a, b) => a.seq - b.seq);
}

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

function flushToDisk() {
  saveQueue = saveQueue.then(async () => {
    if (!canPersist) return;
    try {
      await STORAGE_FILE.write(JSON.stringify(cachedLog));
    } catch (e) {
      console.error('Failed to save analytics log:', e);
    }
  });
}

function appendEvent(event: AnalyticsEvent) {
  cachedLog = [...cachedLog, event];
  notify();
  flushToDisk();
}

/**
 * 読み込みは 1 回だけ実行し、並走呼び出しを dedupe する。
 * 失敗時は loadPromise を null に戻して再試行可能にする。
 */
export function loadAnalyticsLogAsync(): Promise<void> {
  if (loadPromise) {
    return loadPromise;
  }
  loadPromise = (async () => {
    try {
      if (STORAGE_FILE.exists) {
        cachedLog = parseLog(await STORAGE_FILE.text());
      }
      canPersist = true;
      isLoaded = true;
      notify();
    } catch (e) {
      console.error('Failed to load analytics log:', e);
      loadPromise = null;
      notify();
      return;
    }
  })();
  return loadPromise;
}

/**
 * 分析イベントを端末内ログに記録する。
 * 外部送信はしない。個人を特定する情報は payload に含めないこと。
 *
 * 課金関連 (paywall_viewed / purchase_completed) は課金実装 (#17〜#19) の
 * 発火箇所から呼ばれる前提のフック。現状は呼び出し箇所が存在しないため
 * 記録されない。実装時にペイウォール表示と購入完了から logEvent を呼ぶこと。
 */
export function logEvent(
  type: AnalyticsEventType,
  payload?: Record<string, string | number | boolean>
) {
  // まだ読み込みが完了していない場合は、読み込み完了後に改めて記録する
  // (これによりアプリのどの画面から最初に logEvent が呼ばれても
  //  ログの読み込みと永続化が行われる)
  if (!isLoaded) {
    void loadAnalyticsLogAsync().then(() => {
      logEvent(type, payload);
    });
    return;
  }
  // app_first_open は一度だけ記録する (2 回目以降の起動では発火しない)
  if (type === 'app_first_open' && cachedLog.some((e) => e.type === 'app_first_open')) {
    return;
  }
  const maxSeq = cachedLog.length > 0 ? cachedLog[cachedLog.length - 1].seq : 0;
  appendEvent({ seq: maxSeq + 1, type, timestamp: localIsoTime(), payload });
}

export function useAnalyticsLog() {
  const [log, setLog] = useState(cachedLog);

  useEffect(() => {
    if (!isLoaded) {
      void loadAnalyticsLogAsync();
    }
    const listener = () => setLog(cachedLog);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return log;
}
