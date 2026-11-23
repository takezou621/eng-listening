import { LINKING_LABELS, LINKING_SYMBOLS } from '@/features/lesson/linkingViz';
import { getLessonList, type LessonBundle } from '@/features/lesson/registry';
import type { LessonLinkingNote } from '@/features/lesson/types';

/**
 * 聞き取り診断 (全 8 種網羅 8 問標準 / 16 問精密) の問題定義と分析ロジック。
 *
 * 既存 12 レッスンの音声アセットの区間再生と、生成時に付与済みのリンキング
 * 注釈データのみを使う (新規 TTS 生成・アセット変更はしない)。
 * W8 準拠:
 * - 各設問の span は文中で 1 度だけ出現し、空欄マスクにより正解が設問文に露出しない。
 * - choices[0] が正解、画面側で設問ごとに決定的シャッフルして配置を分散する。
 */

export type DiagnosticMode = 'quick' | 'full';

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

/** 標準 8 問セット (約 60 秒・音変化全 8 種を 1 問ずつ網羅) */
export const DIAGNOSTIC_QUESTIONS_QUICK: DiagnosticQuestion[] = [
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
  {
    lessonId: 'cafe-ordering',
    sentenceIndex: 6,
    type: 'palatalization',
    span: 'get your',
    choices: ['get your', 'get her', 'get a'],
  },
  {
    lessonId: 'shopping-clothes',
    sentenceIndex: 2,
    type: 'elision',
    span: 'Let me',
    choices: ['Let me', 'Leave me', 'Lend me'],
  },
  {
    lessonId: 'my-favorite-movie',
    sentenceIndex: 2,
    type: 'weak-form',
    span: 'with his',
    choices: ['with his', 'with this', 'with us'],
  },
  {
    lessonId: 'cafe-ordering',
    sentenceIndex: 3,
    type: 'assimilation',
    span: 'Just the',
    choices: ['Just the', 'Just a', 'Guess the'],
  },
  {
    lessonId: 'small-talk-coworker',
    sentenceIndex: 6,
    type: 'intrusion',
    span: 'go over',
    choices: ['go over', 'grow over', 'go lower'],
  },
];

/** 精密 16 問セット (約 2 分・全 8 種を各 2 問ずつ測定しタイプ別正答率の信頼性を向上) */
export const DIAGNOSTIC_QUESTIONS_FULL: DiagnosticQuestion[] = [
  ...DIAGNOSTIC_QUESTIONS_QUICK,
  {
    lessonId: 'my-favorite-movie',
    sentenceIndex: 9,
    type: 'flapping',
    span: 'lot of',
    choices: ['lot of', 'loud of', 'part of'],
  },
  {
    lessonId: 'my-favorite-movie',
    sentenceIndex: 0,
    type: 'reduction',
    span: 'want to',
    choices: ['want to', 'went to', 'one to'],
  },
  {
    lessonId: 'at-the-airport',
    sentenceIndex: 0,
    type: 'linking',
    span: 'Could I',
    choices: ['Could I', 'Should I', 'Good eye'],
  },
  {
    lessonId: 'small-talk-coworker',
    sentenceIndex: 0,
    type: 'palatalization',
    span: 'Did you',
    choices: ['Did you', 'Do you', 'Would you'],
  },
  {
    lessonId: 'phone-appointment',
    sentenceIndex: 2,
    type: 'elision',
    span: 'next Tuesday',
    choices: ['next Tuesday', 'this Tuesday', 'next Thursday'],
  },
  {
    lessonId: 'small-talk-coworker',
    sentenceIndex: 4,
    type: 'weak-form',
    span: 'for a',
    choices: ['for a', 'from a', 'fall a'],
  },
  {
    lessonId: 'cafe-ordering',
    sentenceIndex: 5,
    type: 'assimilation',
    span: 'That sounds',
    choices: ['That sounds', 'It sounds', 'This sounds'],
  },
  {
    lessonId: 'asking-directions',
    sentenceIndex: 9,
    type: 'intrusion',
    span: 'easy enough',
    choices: ['easy enough', 'really enough', 'is it enough'],
  },
];

/** 互換用デフォルト問題リスト (標準 8 問) */
export const DIAGNOSTIC_QUESTIONS: DiagnosticQuestion[] = DIAGNOSTIC_QUESTIONS_QUICK;

export function getDiagnosticQuestions(mode: DiagnosticMode): DiagnosticQuestion[] {
  return mode === 'full' ? DIAGNOSTIC_QUESTIONS_FULL : DIAGNOSTIC_QUESTIONS_QUICK;
}

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

export interface TypeAccuracyItem {
  type: LessonLinkingNote['type'];
  label: string;
  symbol: string;
  correct: number;
  total: number;
  accuracyPercent: number;
}

/** 音変化タイプごとの正答率を計算し、弱点 (正答率が低い順) で返す */
export function computeTypeAccuracyBreakdown(
  results: DiagnosticResult[]
): TypeAccuracyItem[] {
  const counts = new Map<LessonLinkingNote['type'], { correct: number; total: number }>();
  for (const r of results) {
    const prev = counts.get(r.type) ?? { correct: 0, total: 0 };
    counts.set(r.type, {
      correct: prev.correct + (r.correct ? 1 : 0),
      total: prev.total + 1,
    });
  }
  const list: TypeAccuracyItem[] = [];
  for (const [type, stat] of counts.entries()) {
    list.push({
      type,
      label: LINKING_LABELS[type] ?? type,
      symbol: LINKING_SYMBOLS[type] ?? '•',
      correct: stat.correct,
      total: stat.total,
      accuracyPercent: Math.round((stat.correct / Math.max(stat.total, 1)) * 100),
    });
  }
  return list.sort((a, b) => {
    if (a.accuracyPercent !== b.accuracyPercent) {
      return a.accuracyPercent - b.accuracyPercent;
    }
    const aMissed = a.total - a.correct;
    const bMissed = b.total - b.correct;
    if (bMissed !== aMissed) return bMissed - aMissed;
    return a.type.localeCompare(b.type);
  });
}

export type TypeDeltaTrend = 'improved' | 'same' | 'declined' | 'new';

export interface DiagnosticComparison {
  previousScore: number;
  previousTotal: number;
  previousAccuracyPercent: number;
  deltaAccuracyPercent: number;
  typeTrends: Partial<Record<LessonLinkingNote['type'], TypeDeltaTrend>>;
}

/** 今回の診断内訳と前回試行を比較する */
export function compareDiagnosticAttempts(
  currentBreakdown: TypeAccuracyItem[],
  currentAccuracyPercent: number,
  previous: {
    score: number;
    total: number;
    accuracyPercent: number;
    byType: Partial<Record<LessonLinkingNote['type'], { correct: number; total: number }>>;
  } | null
): DiagnosticComparison | null {
  if (!previous) return null;
  const typeTrends: Partial<Record<LessonLinkingNote['type'], TypeDeltaTrend>> = {};
  for (const item of currentBreakdown) {
    const prevStat = previous.byType[item.type];
    if (!prevStat || prevStat.total <= 0) {
      typeTrends[item.type] = 'new';
      continue;
    }
    const prevPct = Math.round((prevStat.correct / prevStat.total) * 100);
    if (item.accuracyPercent > prevPct) {
      typeTrends[item.type] = 'improved';
    } else if (item.accuracyPercent < prevPct) {
      typeTrends[item.type] = 'declined';
    } else {
      typeTrends[item.type] = 'same';
    }
  }
  return {
    previousScore: previous.score,
    previousTotal: previous.total,
    previousAccuracyPercent: previous.accuracyPercent,
    deltaAccuracyPercent: currentAccuracyPercent - previous.accuracyPercent,
    typeTrends,
  };
}

/** 正答率に基づくレベル分類 (問数 8 / 16 共通) */
export function computeDiagnosticLevel(
  score: number,
  total: number
): 'beginner' | 'intermediate' | 'advanced' {
  const ratio = total > 0 ? score / total : 0;
  if (ratio >= 0.85) return 'advanced';
  if (ratio >= 0.6) return 'intermediate';
  return 'beginner';
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
