import { LINKING_LABELS } from '@/features/lesson/linkingViz';
import { getLessonList, type LessonBundle } from '@/features/lesson/registry';
import type { LessonLinkingNote } from '@/features/lesson/types';

/**
 * 初回オンボーディング診断 (60 秒 Aha Moment) の問題定義。
 *
 * 既存 12 レッスンの音声アセットの区間再生と、生成時に付与済みのリンキング
 * 注釈データのみを使う (新規 TTS 生成・アセット変更はしない)。
 * 選択肢は「実際の単語列 (正解)」と「音の変化で聞こえたままの表記 (誤答)」を
 * 組み合わせることで、単語は知っているのに聞き取れない瞬間を見せる。
 */

export interface DiagnosticQuestion {
  /** 出題元レッスン (既存アセットの区間を再生する) */
  lessonId: string;
  /** 文カードの index (0 起算) */
  sentenceIndex: number;
  /** 問う音の変化の種類 (linking 注釈の type) */
  type: LessonLinkingNote['type'];
  /** 問う部分 (lesson.json の linking.span と一致) */
  span: string;
  /** 選択肢: [0] が正解 (実際の単語列)、以降は音の変化で聞こえたままの誤答 */
  choices: string[];
}

export const DIAGNOSTIC_QUESTIONS: DiagnosticQuestion[] = [
  {
    lessonId: 'asking-directions',
    sentenceIndex: 1,
    type: 'flapping',
    span: 'it is',
    choices: ['it is', 'ID is', 'each is'],
  },
  {
    lessonId: 'small-talk-coworker',
    sentenceIndex: 2,
    type: 'reduction',
    span: 'going to',
    choices: ['going to', 'goner', 'good to'],
  },
  {
    lessonId: 'weekend-in-kyoto',
    sentenceIndex: 0,
    type: 'linking',
    span: 'took a',
    choices: ['took a', 'took her', 'two cars'],
  },
];

/** 診断結果: 種類ごとの正解/不正解と元文の参照 */
export interface DiagnosticResult {
  lessonId: string;
  sentenceIndex: number;
  type: LessonLinkingNote['type'];
  span: string;
  correct: boolean;
}

/** 弱点 (不正解だった) の種類を集計する */
export function countMissedTypes(results: DiagnosticResult[]): Record<string, number> {
  const missed: Record<string, number> = {};
  for (const r of results) {
    if (!r.correct) {
      missed[r.type] = (missed[r.type] ?? 0) + 1;
    }
  }
  return missed;
}

/**
 * 弱点に合う推薦レッスンを返す。
 * - 不正解がある場合: 不正解種類の注釈を最も多く含むレッスン
 * - 全問正解の場合: 自然な発話スピードに慣れる中級レッスン (フォールバックで先頭)
 */
export function pickRecommendedLesson(
  missedTypes: Record<string, number>,
  bundles: LessonBundle[]
): { lessonId: string; title: string; titleJa: string; reason: string } | null {
  const missedOrder = Object.entries(missedTypes)
    .sort((a, b) => b[1] - a[1])
    .map(([type]) => type);

  if (missedOrder.length === 0) {
    const nextStep = bundles.find((b) => b.data.level === 'intermediate') ?? bundles[0];
    if (!nextStep) return null;
    return {
      lessonId: nextStep.data.id,
      title: nextStep.data.title,
      titleJa: nextStep.data.titleJa,
      reason: '全問正解です！自然な会話スピードの中級レッスンでさらに聞き取りを磨きましょう。',
    };
  }

  let best: { bundle: LessonBundle; score: number } | null = null;
  for (const bundle of bundles) {
    let score = 0;
    for (const sentence of bundle.data.sentences) {
      for (const note of sentence.linking) {
        const rank = missedOrder.indexOf(note.type);
        if (rank >= 0) {
          score += missedOrder.length - rank;
        }
      }
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { bundle, score };
    }
  }
  if (!best) return null;
  const weakest = missedOrder[0] as LessonLinkingNote['type'];
  return {
    lessonId: best.bundle.data.id,
    title: best.bundle.data.title,
    titleJa: best.bundle.data.titleJa,
    reason: `${LINKING_LABELS[weakest] ?? weakest}の音の変化が多く出てくるレッスンです。まずこの 1 本で鍛えましょう。`,
  };
}

/** 診問の文・注釈を registry の実データから取得する (二重管理しない) */
export function resolveQuestionData(question: DiagnosticQuestion): {
  bundle: LessonBundle;
  text: string;
  startSec: number;
  endSec: number;
  note: LessonLinkingNote | null;
} | null {
  const bundle = getLessonList().find((l) => l.entry.id === question.lessonId)?.bundle;
  if (!bundle) return null;
  const sentence = bundle.data.sentences[question.sentenceIndex];
  if (!sentence) return null;
  const note = sentence.linking.find((n) => n.span === question.span) ?? null;
  return { bundle, text: sentence.text, startSec: sentence.startSec, endSec: sentence.endSec, note };
}
