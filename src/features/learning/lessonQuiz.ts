import type { LessonData, LessonLinkingNote, LessonSentence } from '@/features/lesson/types';

/**
 * レッスン完了直後の「ミニ聞き分けクイズ」設問構築 (Issue #103)。
 *
 * レッスン内の音変化ノート (LessonLinkingNote) を素材に、文の中の該当スパンを
 * 空欄に置き換えた空欄選択問題を最大 2 問作る純関数群 (React 非依存)。
 * 出題時点では noteJa / ipa を見せず、解答後の解説でのみ使う (検索練習による定着)。
 *
 * 設問が作れないレッスン (ノート不足・外注が揃わない) では 0 問を返し、
 * 呼び出し側は従来どおり完了サマリへ進む (フォールバック原則)。
 */

export const QUIZ_BLANK = '＿＿＿';
export const MAX_QUIZ_QUESTIONS = 2;
/** 選択肢数 (正解 1 + 外注 3) */
export const QUIZ_OPTION_COUNT = 4;

export interface LessonQuizQuestion {
  /** 出題したノートの音変化タイプ */
  soundChangeType: LessonLinkingNote['type'];
  sentenceIndex: number;
  /** 空欄を埋める正解フレーズ (note.span) */
  correctText: string;
  /** 正解を除く選択肢 (同一レッスン内の他ノートの span) */
  distractors: string[];
  /** 正解スパンを空欄に置き換えた英文 */
  prompt: string;
  /** 解答後の解説でのみ表示 */
  noteJa: string;
  ipa: string;
  /** 出題文が事前に苦手フレーズ登録済みだったか */
  wasWeak: boolean;
}

export interface WeakSentenceLikeForQuiz {
  lessonId: string;
  sentenceIndex: number;
}

export interface BuildLessonQuizOptions {
  /** テスト用に差し替え可能な乱数源 (既定: Math.random) */
  random?: () => number;
  /** 最大出題数 (既定: 2、上限 2) */
  maxQuestions?: number;
}

/** needle の最初の出現位置を大小文字を無視して探す (-1 = なし) */
function indexOfIgnoreCase(haystack: string, needle: string): number {
  return haystack.toLowerCase().indexOf(needle.toLowerCase());
}

/** 配列のシャッフルコピー (Fisher–Yates) */
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

/**
 * 文とノートから空欄付き設問文を作る。作れない場合は null。
 * - スペルミスマッチで note.span が text に見つからない文は候補から外す
 * - W8: 置き換えた後も prompt に正解文字列が部分一致で残る場合は外す
 */
export function sentenceToPrompt(
  sentence: Pick<LessonSentence, 'text'>,
  note: Pick<LessonLinkingNote, 'span'>,
): string | null {
  const span = note.span.trim();
  if (!span) return null;
  const at = indexOfIgnoreCase(sentence.text, span);
  if (at < 0) return null;
  const prompt = sentence.text.slice(0, at) + QUIZ_BLANK + sentence.text.slice(at + span.length);
  if (indexOfIgnoreCase(prompt, span) >= 0) return null;
  return prompt;
}

interface NoteCandidate {
  sentenceIndex: number;
  noteIndex: number;
  span: string;
  type: LessonLinkingNote['type'];
  ipa: string;
  noteJa: string;
  prompt: string;
  noteCount: number;
}

/** 外注 (正解以外の span) を最大 3 つ選ぶ。設問文に見えている span は後回し */
function pickDistractors(
  correct: string,
  prompt: string,
  allSpans: readonly string[],
  random: () => number,
): string[] {
  const preferred: string[] = [];
  const fallback: string[] = [];
  for (const span of shuffle(allSpans, random)) {
    if (span.toLowerCase() === correct.toLowerCase()) continue;
    if (indexOfIgnoreCase(prompt, span) >= 0) {
      fallback.push(span);
      continue;
    }
    preferred.push(span);
  }
  return [...preferred, ...fallback].slice(0, QUIZ_OPTION_COUNT - 1);
}

/**
 * レッスン完了後のミニ聞き分けクイズを構築する。
 *
 * 出題順: 苦手フレーズ登録済みの文を優先 → ノート数が多い文順。
 * 1 文 1 問とし、同一レッスン内の他ノートの span から外注 3 つを揃えられない問は作らない。
 * 選択肢の表示順は lessonQuizOptions で呼び出しごとにシャッフルする。
 */
export function buildLessonQuiz(
  lesson: Pick<LessonData, 'id' | 'sentences'>,
  weakSentences: readonly WeakSentenceLikeForQuiz[] = [],
  opts: BuildLessonQuizOptions = {},
): LessonQuizQuestion[] {
  const random = opts.random ?? Math.random;
  const maxQuestions = Math.max(
    0,
    Math.min(opts.maxQuestions ?? MAX_QUIZ_QUESTIONS, MAX_QUIZ_QUESTIONS),
  );
  if (maxQuestions === 0) return [];

  const weakKeys = new Set(weakSentences.map((w) => `${w.lessonId}:${w.sentenceIndex}`));

  // レッスン内の全ノートの span (外注の素材)。大小文字違いの重複はまとめる
  const allSpans: string[] = [];
  for (const s of lesson.sentences) {
    for (const n of s.linking) {
      const span = n.span.trim();
      if (span && !allSpans.some((x) => x.toLowerCase() === span.toLowerCase())) {
        allSpans.push(span);
      }
    }
  }
  if (allSpans.length < QUIZ_OPTION_COUNT) return [];

  const candidates: NoteCandidate[] = [];
  for (const sentence of lesson.sentences) {
    for (let noteIndex = 0; noteIndex < sentence.linking.length; noteIndex++) {
      const note = sentence.linking[noteIndex];
      const prompt = sentenceToPrompt(sentence, note);
      if (prompt === null) continue;
      candidates.push({
        sentenceIndex: sentence.index,
        noteIndex,
        span: note.span.trim(),
        type: note.type,
        ipa: note.ipa,
        noteJa: note.noteJa,
        prompt,
        noteCount: sentence.linking.length,
      });
    }
  }

  const isWeakSentence = (sentenceIndex: number) =>
    weakKeys.has(`${lesson.id}:${sentenceIndex}`);

  const ordered = [...candidates].sort((a, b) => {
    const wa = isWeakSentence(a.sentenceIndex) ? 0 : 1;
    const wb = isWeakSentence(b.sentenceIndex) ? 0 : 1;
    if (wa !== wb) return wa - wb;
    if (a.noteCount !== b.noteCount) return b.noteCount - a.noteCount;
    if (a.sentenceIndex !== b.sentenceIndex) return a.sentenceIndex - b.sentenceIndex;
    return a.noteIndex - b.noteIndex;
  });

  const questions: LessonQuizQuestion[] = [];
  const usedSentences = new Set<number>();
  for (const c of ordered) {
    if (questions.length >= maxQuestions) break;
    if (usedSentences.has(c.sentenceIndex)) continue;
    const distractors = pickDistractors(c.span, c.prompt, allSpans, random);
    if (distractors.length < QUIZ_OPTION_COUNT - 1) continue;
    usedSentences.add(c.sentenceIndex);
    questions.push({
      soundChangeType: c.type,
      sentenceIndex: c.sentenceIndex,
      correctText: c.span,
      distractors,
      prompt: c.prompt,
      noteJa: c.noteJa,
      ipa: c.ipa,
      wasWeak: isWeakSentence(c.sentenceIndex),
    });
  }
  return questions;
}

/** 設問の選択肢 (正解 + 外注) をシャッフルして返す。表示順は呼び出しごとに変わる */
export function lessonQuizOptions(
  question: Pick<LessonQuizQuestion, 'correctText' | 'distractors'>,
  random: () => number = Math.random,
): string[] {
  return shuffle([question.correctText, ...question.distractors], random);
}
