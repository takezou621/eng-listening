import type { LessonLinkingNote, LessonSentence } from '@/features/lesson/types';

/**
 * 音の変化 (リンキング等) の可視化: 種類ごとの色と凡例ラベル、
 * 文中のどの単語がどの注釈に重なるかのマッピング。
 */

export const LINKING_COLORS: Record<LessonLinkingNote['type'], string> = {
  linking: '#2563EB',
  reduction: '#D97706',
  flapping: '#8B5CF6',
  assimilation: '#0D9488',
  palatalization: '#DB2777',
  elision: '#65A30D',
  intrusion: '#7C3AED',
  'weak-form': '#64748B',
};

export const LINKING_LABELS: Record<LessonLinkingNote['type'], string> = {
  linking: 'リンキング',
  reduction: 'リダクション',
  flapping: 'フラッピング',
  assimilation: '同化',
  palatalization: '口蓋化',
  elision: '脱落',
  intrusion: '侵入',
  'weak-form': '弱形',
};

/**
 * 文内の各単語 (空白区切り) が、どの linking 注釈の span と重なるかを返す。
 * 値は注釈のインデックス (重複時は最初に一致したもの)、重ならない単語は null。
 * 返り値の長さは text を空白分割したトークン数と一致する。
 * span が text に見つからない注釈は無視する (生成時に検証済みだが二重防護)。
 */
export function wordLinkMap(sentence: LessonSentence): (number | null)[] {
  const words = sentence.text.split(/\s+/).filter((t) => t.length > 0);
  const map: (number | null)[] = words.map(() => null);
  let cursor = 0;
  const ranges: { start: number; end: number }[] = [];
  for (const token of sentence.text.split(/\s+/)) {
    if (token.length === 0) {
      continue;
    }
    const start = sentence.text.indexOf(token, cursor);
    ranges.push({ start, end: start + token.length });
    cursor = start + token.length;
  }
  sentence.linking.forEach((note, noteIndex) => {
    const spanStart = sentence.text.indexOf(note.span);
    if (spanStart < 0) {
      return;
    }
    const spanEnd = spanStart + note.span.length;
    ranges.forEach((r, wordIndex) => {
      if (map[wordIndex] === null && r.start < spanEnd && r.end > spanStart) {
        map[wordIndex] = noteIndex;
      }
    });
  });
  return map;
}
