import { Paths, File } from 'expo-file-system';
import { useCallback, useSyncExternalStore } from 'react';

import { logEvent } from '../analytics/analyticsStore';

/**
 * レッスン再開位置の永続化ストア (Issue #97 前半)。
 * レッスンごとの「最後に再生していた文 (0 始点)」を端末内の JSON に保存する。
 * progressStore と同じ方式 (expo-file-system + インメモリキャッシュ + 直列化書き込みキュー +
 * リスナー) を踏襲するが、保存先は別ファイル。progress / playerPrefs のスキーマは触らない。
 * データは端末内のみで外部送信しない。
 */

const STORAGE_FILE = new File(Paths.document, 'lesson-resume-data.json');
/** 登録するレッスンの上限 (古いものから切り捨てる) */
const MAX_ENTRIES = 50;

type ResumeData = Record<string, number>;

let cachedData: ResumeData = {};
let loadPromise: Promise<void> | null = null;
let isLoaded = false;
let canPersist = false;
let saveQueue: Promise<void> = Promise.resolve();
const listeners = new Set<() => void>();
/** 読み込み完了前に行われた削除。読み込み後に反映する (古い位置の復元を防ぐ) */
const pendingClears = new Set<string>();

/** 寛容なパース: 不正 JSON / 不正型は空扱い。文 0 は「再開位置なし」と同義なので捨てる */
function parseResume(json: string): ResumeData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return {};
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
  const out: ResumeData = {};
  for (const [lessonId, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (lessonId.length === 0) continue;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 1) continue;
    out[lessonId] = Math.floor(value);
  }
  return out;
}

function notify() {
  for (const listener of listeners) listener();
}

function flushToDisk() {
  saveQueue = saveQueue.then(async () => {
    try {
      await STORAGE_FILE.write(JSON.stringify(cachedData));
    } catch (e) {
      console.error('Failed to save lesson resume data:', e);
    }
  });
}

/** 読み込みは 1 回だけ。失敗時は再試行可能にし、既存ファイルを保護する */
function loadAsync(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      if (STORAGE_FILE.exists) {
        const parsed = parseResume(await STORAGE_FILE.text());
        // 読み込み前にメモリへ蓄積された分を優先してマージ
        cachedData = { ...parsed, ...cachedData };
        for (const id of pendingClears) delete cachedData[id];
      }
      canPersist = true;
    } catch (e) {
      console.error('Failed to load lesson resume data:', e);
      // 再試行可能にする: isLoaded は立てず、次回の ensureLoaded() で読み込みをやり直す
      // (canPersist は false のまま = 既存ファイルを保護する)
      loadPromise = null;
      return;
    }
    pendingClears.clear();
    isLoaded = true;
    flushToDisk();
  })();
  return loadPromise;
}

function ensureLoaded() {
  if (!isLoaded) void loadAsync();
}

function updateData(next: ResumeData) {
  cachedData = next;
  notify();
  if (canPersist) flushToDisk();
}

/** 再開位置 (0 始点の文インデックス)。保存されていない / 文 0 なら null */
export function getLessonResumePosition(lessonId: string): number | null {
  ensureLoaded();
  const v = cachedData[lessonId];
  return typeof v === 'number' && v >= 1 ? v : null;
}

/** 最終再生文位置を保存する。文 0 (先頭) は「再開位置なし」なので保存しない */
export function saveLessonResumePosition(lessonId: string, sentenceIndex: number) {
  ensureLoaded();
  if (!lessonId) return;
  const idx = Math.floor(sentenceIndex);
  if (Number.isFinite(idx) && idx >= 1) pendingClears.delete(lessonId);
  if (!Number.isFinite(idx) || idx < 1) {
    clearLessonResumePosition(lessonId);
    return;
  }
  if (cachedData[lessonId] === idx) return; // 同値は再書き込みしない
  const rest = { ...cachedData };
  delete rest[lessonId];
  const entries = Object.entries(rest);
  updateData(
    Object.fromEntries(
      [...entries.slice(-(MAX_ENTRIES - 1)), [lessonId, idx] as const]
    )
  );
}

export function clearLessonResumePosition(lessonId: string) {
  ensureLoaded();
  if (!canPersist) pendingClears.add(lessonId);
  if (!(lessonId in cachedData)) return;
  const next = { ...cachedData };
  delete next[lessonId];
  updateData(next);
}

function subscribe(listener: () => void) {
  ensureLoaded();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useLessonResumePosition(lessonId: string): number | null {
  const getSnapshot = useCallback(() => getLessonResumePosition(lessonId), [lessonId]);
  // getSnapshot は毎回新しい関数を作らない (useSyncExternalStore の要件)
  return useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => null
  );
}

/** ホームからレッスンを開くときの再開選択ダイアログのボタン (Alert 互換の形) */
export interface ResumeAlertButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

export interface OpenLessonWithResumeParams {
  lessonId: string;
  /** 再開位置 (0 始点の文インデックス)。null なら従来どおり直接開く */
  resumeAt: number | null;
  /** 遷移 (例: router.push) */
  push: (path: string) => void;
  /** OS 標準ダイアログ (例: Alert.alert)。内部で直接呼ばず注入して純関数に保つ */
  alert: (
    title: string,
    message?: string,
    buttons?: ResumeAlertButton[],
    options?: { cancelable?: boolean }
  ) => void;
}

/** 全レッスンの再開位置一覧 (リスト項目ごとにフックを呼べない画面用) */
export function useLessonResumeData(): Readonly<Record<string, number>> {
  return useSyncExternalStore(subscribe, () => cachedData, () => ({}));
}

/**
 * ホーム導線の共通ヘルパー (純関数)。再開位置がなければそのまま開き、
 * あれば「文 N から再開 / 先頭から / キャンセル」を選ばせてから遷移する。
 * `?sentence=` は 1 始点で解釈されるため、表示する文番号とパラメータは resumeAt + 1。
 */
export function openLessonWithResume({
  lessonId,
  resumeAt,
  push,
  alert,
}: OpenLessonWithResumeParams): void {
  const startPath = `/lesson?lesson=${lessonId}`;
  if (resumeAt === null || resumeAt < 1) {
    push(startPath);
    return;
  }
  const sentenceNumber = resumeAt + 1;
  logEvent('lesson_resume_offered', { lessonId, sentenceIndex: sentenceNumber });
  const choose = (choice: 'resume' | 'restart') => {
    logEvent('lesson_resume_chosen', { lessonId, sentenceIndex: sentenceNumber, choice });
    push(choice === 'resume' ? `${startPath}&sentence=${sentenceNumber}` : startPath);
  };
  alert(
    '前回の続きから',
    `このレッスンは文 ${sentenceNumber} まで進んでいます。どこからはじめますか？`,
    [
      { text: 'キャンセル', style: 'cancel' },
      { text: '先頭から', onPress: () => choose('restart') },
      // iOS では style 'default' が太字 (プライマリ相当) で表示される
      { text: `文 ${sentenceNumber} から再開`, style: 'default', onPress: () => choose('resume') },
    ],
    { cancelable: true }
  );
}
