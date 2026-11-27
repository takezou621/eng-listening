import { Paths, File } from 'expo-file-system';
import { useEffect, useState } from 'react';

import { recordError } from './crash';
import { forwardEventToGa4 } from './ga4';

/**
 * 分析イベントの記録 (Issue #21 最小実装 + v1.1 GA4 送信)。
 *
 * - イベントは端末内の JSON ファイルに記録し (端末内確認・デバッグ用)、
 *   v1.1 からは GA4 (Firebase Analytics) にも送信する。送信は ga4.ts が担当し、
 *   ネイティブモジュールが使えない環境では no-op になる。
 * - 個人を特定する情報は記録・送信しない。端末内ログのイベントには端末内連番
 *   (seq) とローカル時刻のみ。GA4 側の集計は Firebase の自動収集識別子による。
 * - 計測設計の正は docs/metrics.md。
 */

const STORAGE_FILE = new File(Paths.document, 'analytics-log.json');

/** 記録できるイベントの種類 */
export type AnalyticsEventType =
  | 'app_first_open'
  | 'onboarding_started'
  | 'onboarding_completed'
  | 'onboarding_skipped'
  | 'rediagnosis_completed'
  | 'diagnostic_answered'
  | 'lesson_started'
  | 'lesson_completed'
  | 'lesson_quiz_shown'
  | 'lesson_quiz_answered'
  | 'lesson_quiz_skipped'
  | 'lesson_abandoned'
  | 'lesson_resume_offered'
  | 'lesson_resume_chosen'
  | 'lesson_mode_changed'
  | 'linking_note_opened'
  | 'playback_control'
  | 'shadowing_recorded'
  | 'shadowing_compared'
  | 'weak_phrase_added'
  | 'weak_phrase_removed'
  | 'paywall_viewed'
  | 'paywall_plan_selected'
  | 'purchase_started'
  | 'purchase_completed'
  | 'purchase_failed'
  | 'restore_completed'
  | 'subscription_manage_tapped'
  | 'watch_session_synced'
  | 'overcoming_step_completed'
  | 'curriculum_viewed'
  | 'curriculum_customized'
  | 'key_phrase_opened'
  | 'weak_phrase_reviewed'
  | 'weak_phrase_graduated'
  | 'weak_phrase_playlist_started'
  | 'weak_phrase_playlist_finished';

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
      recordError(e, 'analytics_flush_failed');
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
      recordError(e, 'analytics_load_failed');
      // 失敗時も isLoaded = true にして logEvent からの無限再試行を止める。
      // canPersist は false のまま (壊れた既存ファイルの保護)。
      // このセッションのイベントはメモリにのみ蓄積され、永続化は次回起動時に委ねる。
      loadPromise = null;
      isLoaded = true;
      notify();
      return;
    }
  })();
  return loadPromise;
}

/**
 * 分析イベントを記録する。端末内ログへの追記に加えて GA4 にも送信する
 * (送信失敗は ga4.ts 側で吸収され、この関数の動作には影響しない)。
 * 個人を特定する情報は payload に含めないこと。
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
  forwardEventToGa4(type, payload);
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
