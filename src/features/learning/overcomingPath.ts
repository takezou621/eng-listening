import {
  ALL_SOUND_TYPES,
  type TypeMasteryEntry,
  type WeakSentenceLike,
} from '@/features/learning/masteryStore';
import { LINKING_LABELS } from '@/features/lesson/linkingViz';
import type { LessonListItem } from '@/features/lesson/registry';
import type { LessonData, LessonLinkingNote } from '@/features/lesson/types';

/**
 * 3 ステップ段階的克服パス (Phase 1-C)。
 *
 * 1. ① 聞き分け (listen): 注目タイプの音変化解説を確認する
 * 2. ② 文で確認 (read): カラオケ風表示と訳・チャンクで音のつながりを理解する
 * 3. ③ 話す (speak): 自分の声でシャドーイングして再現する
 */

export type OvercomingStepKey = 'listen' | 'read' | 'speak';

export const OVERCOMING_STEPS: readonly {
  key: OvercomingStepKey;
  stepNum: number;
  shortLabel: string;
  description: string;
}[] = [
  { key: 'listen', stepNum: 1, shortLabel: '① 聞き分け', description: '音変化をタップで確認' },
  { key: 'read', stepNum: 2, shortLabel: '② 文で確認', description: '文字と訳で構造を整理' },
  { key: 'speak', stepNum: 3, shortLabel: '③ 話す', description: '声に出して再現する' },
];

export interface OvercomingLessonPick {
  item: LessonListItem;
  reason: string;
}

export interface WeakestFocusPick {
  type: LessonLinkingNote['type'];
  lessonId: string;
  lessonTitle: string;
  reason: string;
}

/** deep link の focus パラメータを安全な音変化タイプへ検証変換する */
export function parseFocusType(raw: string | undefined): LessonLinkingNote['type'] | null {
  if (!raw) return null;
  return (ALL_SOUND_TYPES as readonly string[]).includes(raw)
    ? (raw as LessonLinkingNote['type'])
    : null;
}

/** 指定レッスン内で注目タイプの音変化を含む文の 0 起算ポジション配列を返す */
export function getTargetSentenceIndicesForType(
  lesson: LessonData,
  focusType: LessonLinkingNote['type'],
): number[] {
  const out: number[] = [];
  lesson.sentences.forEach((sentence, pos) => {
    if (sentence.linking.some((note) => note.type === focusType)) {
      out.push(pos);
    }
  });
  return out;
}

function countTypeOccurrences(
  item: LessonListItem,
  focusType: LessonLinkingNote['type'],
): number {
  if (!item.bundle) return 0;
  let count = 0;
  for (const sentence of item.bundle.data.sentences) {
    for (const note of sentence.linking) {
      if (note.type === focusType) count += 1;
    }
  }
  return count;
}

/**
 * 同じ弱点タイプを「基礎 → 応用」「別会話での転移練習」順に繋ぐ次レッスンを選ぶ。
 */
export function pickNextOvercomingLesson(
  focusType: LessonLinkingNote['type'],
  currentLessonId: string,
  completedLessonIds: ReadonlySet<string>,
  lessonList: readonly LessonListItem[],
): OvercomingLessonPick | null {
  const bundled = lessonList.filter((it) => it.bundle !== null);
  const current = bundled.find((it) => it.entry.id === currentLessonId);
  const label = LINKING_LABELS[focusType];

  const withType = bundled
    .filter((it) => it.entry.id !== currentLessonId)
    .map((item) => ({
      item,
      count: countTypeOccurrences(item, focusType),
      completed: completedLessonIds.has(item.entry.id),
      levelRank: item.entry.level === 'beginner' ? 0 : 1,
    }))
    .filter((c) => c.count > 0);

  const uncompleted = withType.filter((c) => !c.completed);
  const pool = uncompleted.length > 0 ? uncompleted : withType;

  if (pool.length > 0) {
    const preferIntermediate = current?.entry.level === 'beginner';
    pool.sort((a, b) => {
      if (!preferIntermediate && a.levelRank !== b.levelRank) {
        return a.levelRank - b.levelRank;
      }
      if (preferIntermediate && a.levelRank !== b.levelRank) {
        // 基礎レッスンを終えた直後は別文脈の応用レッスンや未完了基礎へ自然につなぐ
        return uncompleted.length > 0 ? a.levelRank - b.levelRank : b.levelRank - a.levelRank;
      }
      return b.count - a.count;
    });
    const best = pool[0];
    const levelText = best.item.entry.level === 'beginner' ? '基礎' : '応用';
    const reason =
      uncompleted.length > 0
        ? `「${label}」の${levelText}練習（${best.count} 箇所）`
        : `別シーンで「${label}」を応用確認（${best.count} 箇所）`;
    return { item: best.item, reason };
  }

  // 該当タイプを含む他レッスンが無い場合は通常順の次レッスンへフォールバック
  const currentIdx = bundled.findIndex((it) => it.entry.id === currentLessonId);
  for (let i = currentIdx + 1; i < bundled.length; i++) {
    return { item: bundled[i], reason: '次のレッスンへ進む' };
  }
  return null;
}

/**
 * 習熟度一覧から最も優先して取り組むべき弱点タイプと開始レッスンを 1 件選ぶ。
 * まったく学習・診断データがない場合は null を返す。
 */
export function pickWeakestFocusType(
  masteryList: readonly TypeMasteryEntry[],
  weakSentences: readonly WeakSentenceLike[],
  lessonList: readonly LessonListItem[],
): WeakestFocusPick | null {
  const priority =
    masteryList.find((m) => m.stage === 'weak') ??
    masteryList.find((m) => m.stage === 'developing');
  if (!priority) {
    return null;
  }

  const completedPlaceholder = new Set<string>();
  const bundled = lessonList.filter((it) => it.bundle !== null);
  const weakLessonIds = new Set(
    weakSentences
      .filter((w) => w.graduatedAtMs === undefined || w.graduatedAtMs === null)
      .map((w) => w.lessonId),
  );

  // 未卒業の苦手フレーズがある対象レッスンを優先し、無ければ段階的パスの先頭レッスンを選ぶ
  const weakCandidate = bundled.find(
    (it) =>
      weakLessonIds.has(it.entry.id) && countTypeOccurrences(it, priority.type) > 0,
  );
  if (weakCandidate) {
    return {
      type: priority.type,
      lessonId: weakCandidate.entry.id,
      lessonTitle: weakCandidate.bundle?.data.titleJa ?? weakCandidate.entry.titleJa,
      reason: `苦手フレーズに含まれる「${LINKING_LABELS[priority.type]}」を集中的に克服`,
    };
  }

  const pick = pickNextOvercomingLesson(
    priority.type,
    '',
    completedPlaceholder,
    lessonList,
  );
  if (!pick) return null;
  return {
    type: priority.type,
    lessonId: pick.item.entry.id,
    lessonTitle: pick.item.bundle?.data.titleJa ?? pick.item.entry.titleJa,
    reason: pick.reason,
  };
}
