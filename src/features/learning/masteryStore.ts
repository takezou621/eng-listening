import { File, Paths } from 'expo-file-system';
import { useEffect, useState } from 'react';

import type { LessonListItem } from '@/features/lesson/registry';
import type { LessonLinkingNote } from '@/features/lesson/types';

/**
 * 音変化 8 タイプ別の習熟度永続化ストア (Phase 1-B)。
 *
 * 端末内 Document ディレクトリの `mastery-data.json` に保存し、
 * 診断結果・解説閲覧・シャドーイング・レッスン完了・レッスン内クイズ・3 ステップ克服完了を統合して
 * 各タイプのスコア (0〜100) とステージ (未測定/要強化/練習中/定着) を算出する。
 */

const STORAGE_FILE = new File(Paths.document, 'mastery-data.json');

export const ALL_SOUND_TYPES: readonly LessonLinkingNote['type'][] = [
  'linking',
  'flapping',
  'reduction',
  'palatalization',
  'elision',
  'weak-form',
  'assimilation',
  'intrusion',
];

export type MasteryStage = 'untested' | 'weak' | 'developing' | 'mastered';

export const MASTERY_STAGE_LABELS: Record<MasteryStage, string> = {
  untested: '未測定',
  weak: '要強化',
  developing: '練習中',
  mastered: '定着',
};

export interface TypeMasteryRecord {
  diagnosticCorrect: number;
  diagnosticTotal: number;
  /** レッスン内ミニ聞き分けクイズ (#103) の正答数。旧 JSON では未設定 = 0 */
  quizCorrect: number;
  quizTotal: number;
  linkingNotesOpened: number;
  shadowingCount: number;
  lessonsCompleted: number;
  overcomingCompleted: number;
  lastPracticedAtMs: number | null;
}

export type MasteryStoreData = Partial<Record<LessonLinkingNote['type'], TypeMasteryRecord>>;

export interface WeakSentenceLike {
  lessonId: string;
  sentenceIndex: number;
  graduatedAtMs?: number | null;
  reviewCount?: number;
}

export interface TypeMasteryEntry {
  type: LessonLinkingNote['type'];
  score: number;
  stage: MasteryStage;
  diagnosticCorrect: number;
  diagnosticTotal: number;
  quizCorrect: number;
  quizTotal: number;
  activeWeakCount: number;
  graduatedWeakCount: number;
  linkingNotesOpened: number;
  shadowingCount: number;
  lessonsCompleted: number;
  overcomingCompleted: number;
  practiceCount: number;
}

function emptyRecord(): TypeMasteryRecord {
  return {
    diagnosticCorrect: 0,
    diagnosticTotal: 0,
    quizCorrect: 0,
    quizTotal: 0,
    linkingNotesOpened: 0,
    shadowingCount: 0,
    lessonsCompleted: 0,
    overcomingCompleted: 0,
    lastPracticedAtMs: null,
  };
}

let cachedData: MasteryStoreData = {};
let pendingDelta: MasteryStoreData = {};
let loadPromise: Promise<void> | null = null;
let canPersist = false;
let saveQueue: Promise<void> = Promise.resolve();
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

function isSoundType(key: string): key is LessonLinkingNote['type'] {
  return (ALL_SOUND_TYPES as readonly string[]).includes(key);
}

function sanitizeCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : 0;
}

function mergeRecords(a: TypeMasteryRecord, b: TypeMasteryRecord): TypeMasteryRecord {
  const lastPracticedAtMs =
    a.lastPracticedAtMs !== null && b.lastPracticedAtMs !== null
      ? Math.max(a.lastPracticedAtMs, b.lastPracticedAtMs)
      : (a.lastPracticedAtMs ?? b.lastPracticedAtMs);
  return {
    diagnosticCorrect: a.diagnosticCorrect + b.diagnosticCorrect,
    diagnosticTotal: a.diagnosticTotal + b.diagnosticTotal,
    quizCorrect: a.quizCorrect + b.quizCorrect,
    quizTotal: a.quizTotal + b.quizTotal,
    linkingNotesOpened: a.linkingNotesOpened + b.linkingNotesOpened,
    shadowingCount: a.shadowingCount + b.shadowingCount,
    lessonsCompleted: a.lessonsCompleted + b.lessonsCompleted,
    overcomingCompleted: a.overcomingCompleted + b.overcomingCompleted,
    lastPracticedAtMs,
  };
}

function parseMasteryJson(json: string): MasteryStoreData {
  const parsed: unknown = JSON.parse(json);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return {};
  }
  const out: MasteryStoreData = {};
  for (const [key, raw] of Object.entries(parsed as Record<string, unknown>)) {
    if (!isSoundType(key) || typeof raw !== 'object' || raw === null) continue;
    const rec = raw as Partial<TypeMasteryRecord>;
    out[key] = {
      diagnosticCorrect: sanitizeCount(rec.diagnosticCorrect),
      diagnosticTotal: sanitizeCount(rec.diagnosticTotal),
      quizCorrect: sanitizeCount(rec.quizCorrect),
      quizTotal: sanitizeCount(rec.quizTotal),
      linkingNotesOpened: sanitizeCount(rec.linkingNotesOpened),
      shadowingCount: sanitizeCount(rec.shadowingCount),
      lessonsCompleted: sanitizeCount(rec.lessonsCompleted),
      overcomingCompleted: sanitizeCount(rec.overcomingCompleted),
      lastPracticedAtMs:
        typeof rec.lastPracticedAtMs === 'number' && Number.isFinite(rec.lastPracticedAtMs)
          ? rec.lastPracticedAtMs
          : null,
    };
  }
  return out;
}

function flushToDisk() {
  saveQueue = saveQueue.then(async () => {
    try {
      await STORAGE_FILE.write(JSON.stringify(cachedData));
    } catch (e) {
      console.error('Failed to save mastery data:', e);
    }
  });
}

function applyDelta(
  base: MasteryStoreData,
  delta: MasteryStoreData,
): MasteryStoreData {
  const next: MasteryStoreData = { ...base };
  for (const type of ALL_SOUND_TYPES) {
    const d = delta[type];
    if (!d) continue;
    const prev = next[type] ?? emptyRecord();
    next[type] = mergeRecords(prev, d);
  }
  return next;
}

function mutateData(buildDelta: () => MasteryStoreData) {
  const delta = buildDelta();
  if (!canPersist) {
    pendingDelta = applyDelta(pendingDelta, delta);
  }
  cachedData = applyDelta(cachedData, delta);
  notify();
  if (canPersist) {
    flushToDisk();
  }
}

/**
 * mastery-data.json を非同期に読み込む。並走呼び出しは 1 つに集約する。
 */
export function loadMasteryDataAsync(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    let parsed: MasteryStoreData = {};
    try {
      if (STORAGE_FILE.exists) {
        const text = await STORAGE_FILE.text();
        parsed = parseMasteryJson(text);
      }
    } catch (e) {
      console.error('Failed to load mastery data:', e);
      loadPromise = null;
      notify();
      return;
    }
    canPersist = true;
    const hadPending = Object.keys(pendingDelta).length > 0;
    cachedData = applyDelta(parsed, pendingDelta);
    pendingDelta = {};
    notify();
    if (hadPending) {
      flushToDisk();
    }
  })();
  return loadPromise;
}

/** 現在メモリにある音変化習熟度データを購読する Hook */
export function useMasteryData(): MasteryStoreData {
  const [data, setData] = useState<MasteryStoreData>(cachedData);

  useEffect(() => {
    let cancelled = false;
    void loadMasteryDataAsync().then(() => {
      if (!cancelled) {
        setData(cachedData);
      }
    });
    const listener = () => setData(cachedData);
    listeners.add(listener);
    return () => {
      cancelled = true;
      listeners.delete(listener);
    };
  }, []);

  return data;
}

/** 音変化解説を開いた回数を該当タイプに加算する */
export function recordMasteryLinkingNoteOpened(type: LessonLinkingNote['type']): void {
  const now = Date.now();
  mutateData(() => ({
    [type]: {
      ...emptyRecord(),
      linkingNotesOpened: 1,
      lastPracticedAtMs: now,
    },
  }));
}

/** シャドーイング録音完了時に文に含まれる各タイプへ加算する */
export function recordMasteryShadowing(types: readonly LessonLinkingNote['type'][]): void {
  const unique = [...new Set(types)];
  if (unique.length === 0) return;
  const now = Date.now();
  mutateData(() => {
    const delta: MasteryStoreData = {};
    for (const type of unique) {
      delta[type] = {
        ...emptyRecord(),
        shadowingCount: 1,
        lastPracticedAtMs: now,
      };
    }
    return delta;
  });
}

/** レッスン完了時にレッスンに含まれる各タイプへ加算する */
export function recordMasteryLessonCompleted(types: readonly LessonLinkingNote['type'][]): void {
  const unique = [...new Set(types)];
  if (unique.length === 0) return;
  const now = Date.now();
  mutateData(() => {
    const delta: MasteryStoreData = {};
    for (const type of unique) {
      delta[type] = {
        ...emptyRecord(),
        lessonsCompleted: 1,
        lastPracticedAtMs: now,
      };
    }
    return delta;
  });
}

/** 3 ステップ克服パス全完了時に該当タイプへ加算する */
export function recordMasteryOvercomingCompleted(type: LessonLinkingNote['type']): void {
  const now = Date.now();
  mutateData(() => ({
    [type]: {
      ...emptyRecord(),
      overcomingCompleted: 1,
      lastPracticedAtMs: now,
    },
  }));
}

/** 診断完了結果を各タイプの証拠として加算する */
export function recordMasteryDiagnostic(
  results: readonly { type: LessonLinkingNote['type']; correct: boolean }[],
): void {
  if (results.length === 0) return;
  const now = Date.now();
  mutateData(() => {
    const delta: MasteryStoreData = {};
    for (const r of results) {
      const prev = delta[r.type] ?? emptyRecord();
      delta[r.type] = {
        ...prev,
        diagnosticTotal: prev.diagnosticTotal + 1,
        diagnosticCorrect: prev.diagnosticCorrect + (r.correct ? 1 : 0),
        lastPracticedAtMs: now,
      };
    }
    return delta;
  });
}

/** レッスン内ミニ聞き分けクイズ (#103) の結果を各タイプの証拠として加算する */
export function recordMasteryQuiz(
  results: readonly { type: LessonLinkingNote['type']; correct: boolean }[],
): void {
  if (results.length === 0) return;
  const now = Date.now();
  mutateData(() => {
    const delta: MasteryStoreData = {};
    for (const r of results) {
      const prev = delta[r.type] ?? emptyRecord();
      delta[r.type] = {
        ...prev,
        quizTotal: prev.quizTotal + 1,
        quizCorrect: prev.quizCorrect + (r.correct ? 1 : 0),
        lastPracticedAtMs: now,
      };
    }
    return delta;
  });
}

const STAGE_ORDER: Record<MasteryStage, number> = {
  weak: 0,
  developing: 1,
  untested: 2,
  mastered: 3,
};

/**
 * 全 8 種の音変化タイプごとの習熟度スコア・ステージを算出し、弱点優先で並べて返す。
 * PR #100 の graduatedAtMs / reviewCount が未導入でも互換動作する。
 */
export function computeTypeMasteryList(
  store: MasteryStoreData,
  weakSentences: readonly WeakSentenceLike[],
  completedLessonIds: ReadonlySet<string>,
  lessonList: readonly LessonListItem[],
): TypeMasteryEntry[] {
  const activeWeakByType: Record<LessonLinkingNote['type'], number> = {
    linking: 0,
    flapping: 0,
    reduction: 0,
    palatalization: 0,
    elision: 0,
    'weak-form': 0,
    assimilation: 0,
    intrusion: 0,
  };
  const graduatedWeakByType: Record<LessonLinkingNote['type'], number> = {
    ...activeWeakByType,
  };
  const completedLessonsByType: Record<LessonLinkingNote['type'], number> = {
    ...activeWeakByType,
  };

  for (const item of lessonList) {
    if (!item.bundle || !completedLessonIds.has(item.entry.id)) continue;
    const seen = new Set<LessonLinkingNote['type']>();
    for (const st of item.bundle.data.sentences) {
      for (const note of st.linking) {
        seen.add(note.type);
      }
    }
    for (const type of seen) {
      completedLessonsByType[type] += 1;
    }
  }

  for (const weak of weakSentences) {
    const bundle = lessonList.find((it) => it.entry.id === weak.lessonId)?.bundle;
    const sentence = bundle?.data.sentences.find((st) => st.index === weak.sentenceIndex);
    if (!sentence) continue;
    const typesInSentence = new Set(sentence.linking.map((n) => n.type));
    const graduated = weak.graduatedAtMs !== undefined && weak.graduatedAtMs !== null;
    for (const type of typesInSentence) {
      if (graduated) {
        graduatedWeakByType[type] += 1;
      } else {
        activeWeakByType[type] += 1;
      }
    }
  }

  const entries: TypeMasteryEntry[] = ALL_SOUND_TYPES.map((type) => {
    const rec = store[type] ?? emptyRecord();
    const activeWeakCount = activeWeakByType[type];
    const graduatedWeakCount = graduatedWeakByType[type];
    const lessonsCompleted = Math.max(rec.lessonsCompleted, completedLessonsByType[type]);
    const practiceCount =
      rec.linkingNotesOpened +
      rec.shadowingCount +
      lessonsCompleted +
      rec.overcomingCompleted +
      graduatedWeakCount;

    const evidence =
      rec.diagnosticTotal +
      rec.quizTotal +
      practiceCount +
      activeWeakCount +
      graduatedWeakCount;

    if (evidence === 0) {
      return {
        type,
        score: 0,
        stage: 'untested',
        diagnosticCorrect: rec.diagnosticCorrect,
        diagnosticTotal: rec.diagnosticTotal,
        quizCorrect: rec.quizCorrect,
        quizTotal: rec.quizTotal,
        activeWeakCount,
        graduatedWeakCount,
        linkingNotesOpened: rec.linkingNotesOpened,
        shadowingCount: rec.shadowingCount,
        lessonsCompleted,
        overcomingCompleted: rec.overcomingCompleted,
        practiceCount,
      };
    }

    // 診断 + クイズの合算正答率を基本点にする。診断 0 問でクイズのみの場合は
    // 診断なし扱い (24/40) を維持し、クイズは practiceBoost 側に反映する
    const testedTotal = rec.diagnosticTotal + rec.quizTotal;
    const hasDiagnostic = rec.diagnosticTotal > 0;
    const diagnosticBase = hasDiagnostic
      ? ((rec.diagnosticCorrect + rec.quizCorrect) / testedTotal) * 55
      : activeWeakCount > 0 && practiceCount === 0
        ? 24
        : 40;

    const practiceBoost = Math.min(
      35,
      rec.linkingNotesOpened * 4 +
        rec.shadowingCount * 5 +
        lessonsCompleted * 10 +
        rec.overcomingCompleted * 16 +
        graduatedWeakCount * 8 +
        rec.quizCorrect * 3,
    );

    const stabilityBonus = activeWeakCount === 0 && practiceCount >= 2 ? 12 : 0;
    const weakPenalty = Math.min(35, activeWeakCount * 14);
    const score = Math.max(
      0,
      Math.min(100, Math.round(diagnosticBase + practiceBoost + stabilityBonus - weakPenalty)),
    );

    let stage: MasteryStage;
    if (score >= 75 && activeWeakCount === 0) {
      stage = 'mastered';
    } else if (score < 45 || (activeWeakCount >= 2 && score < 65)) {
      stage = 'weak';
    } else {
      stage = 'developing';
    }

    return {
      type,
      score,
      stage,
      diagnosticCorrect: rec.diagnosticCorrect,
      diagnosticTotal: rec.diagnosticTotal,
      quizCorrect: rec.quizCorrect,
      quizTotal: rec.quizTotal,
      activeWeakCount,
      graduatedWeakCount,
      linkingNotesOpened: rec.linkingNotesOpened,
      shadowingCount: rec.shadowingCount,
      lessonsCompleted,
      overcomingCompleted: rec.overcomingCompleted,
      practiceCount,
    };
  });

  return entries.sort((a, b) => {
    const stageDiff = STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage];
    if (stageDiff !== 0) return stageDiff;
    if (a.score !== b.score) return a.score - b.score;
    return b.activeWeakCount - a.activeWeakCount;
  });
}
