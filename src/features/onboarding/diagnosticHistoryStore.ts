import { Paths, File } from 'expo-file-system';
import { useEffect, useState } from 'react';

import type { LessonLinkingNote } from '@/features/lesson/types';
import {
  countMissedTypes,
  type DiagnosticMode,
  type DiagnosticResult,
} from '@/features/onboarding/diagnostic';

/**
 * 診断履歴の端末内永続化ストア (Phase 1-E 再診断・前回比較用)。
 * 既存 user-data.json には影響を与えず、独立ファイル diagnostic-history.json として保存する。
 */

const STORAGE_FILE = new File(Paths.document, 'diagnostic-history.json');
const MAX_ATTEMPTS = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface DiagnosticTypeStat {
  correct: number;
  total: number;
}

export interface DiagnosticAttempt {
  id: string;
  completedAtMs: number;
  mode: DiagnosticMode;
  score: number;
  total: number;
  accuracyPercent: number;
  byType: Partial<Record<LessonLinkingNote['type'], DiagnosticTypeStat>>;
  missedTypes: Record<string, number>;
}

let cachedHistory: DiagnosticAttempt[] = [];
let isLoaded = false;
let loadPromise: Promise<void> | null = null;
let canPersist = false;
let saveQueue: Promise<void> = Promise.resolve();
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

function parseHistory(json: string): DiagnosticAttempt[] {
  const parsed: unknown = JSON.parse(json);
  if (!Array.isArray(parsed)) return [];
  const out: DiagnosticAttempt[] = [];
  for (const item of parsed) {
    if (typeof item !== 'object' || item === null) continue;
    const r = item as Partial<DiagnosticAttempt>;
    if (
      typeof r.id !== 'string' ||
      typeof r.completedAtMs !== 'number' ||
      !Number.isFinite(r.completedAtMs) ||
      typeof r.score !== 'number' ||
      !Number.isFinite(r.score) ||
      typeof r.total !== 'number' ||
      !Number.isFinite(r.total) ||
      r.total <= 0
    ) {
      continue;
    }
    const mode: DiagnosticMode = r.mode === 'full' ? 'full' : 'quick';
    const accuracyPercent =
      typeof r.accuracyPercent === 'number' && Number.isFinite(r.accuracyPercent)
        ? r.accuracyPercent
        : Math.round((r.score / r.total) * 100);
    const byType: DiagnosticAttempt['byType'] = {};
    if (typeof r.byType === 'object' && r.byType !== null && !Array.isArray(r.byType)) {
      for (const [k, v] of Object.entries(r.byType)) {
        if (
          v &&
          typeof v === 'object' &&
          typeof (v as DiagnosticTypeStat).correct === 'number' &&
          typeof (v as DiagnosticTypeStat).total === 'number'
        ) {
          byType[k as LessonLinkingNote['type']] = {
            correct: (v as DiagnosticTypeStat).correct,
            total: (v as DiagnosticTypeStat).total,
          };
        }
      }
    }
    const missedTypes: Record<string, number> = {};
    if (typeof r.missedTypes === 'object' && r.missedTypes !== null && !Array.isArray(r.missedTypes)) {
      for (const [k, v] of Object.entries(r.missedTypes)) {
        if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
          missedTypes[k] = v;
        }
      }
    }
    out.push({
      id: r.id,
      completedAtMs: r.completedAtMs,
      mode,
      score: r.score,
      total: r.total,
      accuracyPercent,
      byType,
      missedTypes,
    });
  }
  return out.sort((a, b) => b.completedAtMs - a.completedAtMs).slice(0, MAX_ATTEMPTS);
}

function flushToDisk() {
  saveQueue = saveQueue.then(async () => {
    if (!canPersist) return;
    try {
      await STORAGE_FILE.write(JSON.stringify(cachedHistory));
    } catch (e) {
      console.error('Failed to save diagnostic history:', e);
    }
  });
}

export function loadDiagnosticHistoryAsync(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      if (STORAGE_FILE.exists) {
        const parsed = parseHistory(await STORAGE_FILE.text());
        const byId = new Map<string, DiagnosticAttempt>();
        for (const item of [...parsed, ...cachedHistory]) {
          if (!byId.has(item.id)) byId.set(item.id, item);
        }
        cachedHistory = [...byId.values()]
          .sort((a, b) => b.completedAtMs - a.completedAtMs)
          .slice(0, MAX_ATTEMPTS);
      }
      canPersist = true;
      flushToDisk();
    } catch (e) {
      console.error('Failed to load diagnostic history:', e);
    } finally {
      isLoaded = true;
      notify();
    }
  })();
  return loadPromise;
}

export function recordDiagnosticAttempt(params: {
  mode: DiagnosticMode;
  results: DiagnosticResult[];
  completedAtMs?: number;
}): DiagnosticAttempt {
  const now = params.completedAtMs ?? Date.now();
  const total = Math.max(params.results.length, 1);
  const score = params.results.filter((r) => r.correct).length;
  const accuracyPercent = Math.round((score / total) * 100);
  const byType: DiagnosticAttempt['byType'] = {};
  for (const r of params.results) {
    const prev = byType[r.type] ?? { correct: 0, total: 0 };
    byType[r.type] = {
      correct: prev.correct + (r.correct ? 1 : 0),
      total: prev.total + 1,
    };
  }
  const attempt: DiagnosticAttempt = {
    id: `diag-${now}-${score}`,
    completedAtMs: now,
    mode: params.mode,
    score,
    total,
    accuracyPercent,
    byType,
    missedTypes: countMissedTypes(params.results),
  };
  cachedHistory = [attempt, ...cachedHistory].slice(0, MAX_ATTEMPTS);
  notify();
  if (canPersist) {
    flushToDisk();
  }
  return attempt;
}

export function getLatestDiagnosticAttempt(): DiagnosticAttempt | null {
  return cachedHistory[0] ?? null;
}

export function useDiagnosticHistory(): DiagnosticAttempt[] {
  const [history, setHistory] = useState(cachedHistory);

  useEffect(() => {
    if (!isLoaded) {
      void loadDiagnosticHistoryAsync();
    }
    const listener = () => setHistory(cachedHistory);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return history;
}

export interface RediagnosisStatus {
  shouldPrompt: boolean;
  reason: string | null;
  latestAttempt: DiagnosticAttempt | null;
}

/**
 * 一定の学習量到達後に再診断を促す判定。
 * - 初回診断が記録されていること
 * - 完了レッスン 3 本以上、または 7 日経過 + (累計 10 分以上 or シャドーイング 10 回以上)
 */
export function getRediagnosisStatus(
  attempts: readonly DiagnosticAttempt[],
  completedLessonsCount: number,
  totalStudySeconds: number,
  shadowingTotal: number,
  nowMs: number = Date.now()
): RediagnosisStatus {
  const latest = attempts[0] ?? null;
  if (!latest) {
    return { shouldPrompt: false, reason: null, latestAttempt: null };
  }
  const daysSince = (nowMs - latest.completedAtMs) / DAY_MS;
  const enoughLessons = completedLessonsCount >= 3;
  const enoughTimePractice =
    daysSince >= 7 && (totalStudySeconds >= 600 || shadowingTotal >= 10);

  if (enoughLessons || enoughTimePractice) {
    return {
      shouldPrompt: true,
      reason: '学習が進みました。再診断で音変化ごとの伸びを確認できます。',
      latestAttempt: latest,
    };
  }
  return { shouldPrompt: false, reason: null, latestAttempt: latest };
}
