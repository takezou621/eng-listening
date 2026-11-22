import type { LessonLinkingNote, LessonSentence } from '@/features/lesson/types';
import type { AppColorScheme } from '@/theme/colors';

/**
 * 音の変化 (リンキング等) の可視化: 種類ごとの色と凡例ラベル、
 * 文中のどの単語がどの注釈に重なるかのマッピング。
 */

// 音の変化の色 (ライトモード)。UI のアクセント (青, colors.primary) と意味が衝突しないよう、
// 音変化カラーには青系を使わない (Issue #45 C1)。
export const LINKING_COLORS: Record<LessonLinkingNote['type'], string> = {
  linking: '#6D28D9',
  reduction: '#B45309',
  flapping: '#C026D3',
  assimilation: '#0F766E',
  palatalization: '#BE185D',
  elision: '#4D7C0F',
  intrusion: '#B91C1C',
  'weak-form': '#475569',
};

// ダークモード用の高コントラスト色 (暗いカード背景上での視認性確保。W7)
export const LINKING_COLORS_DARK: Record<LessonLinkingNote['type'], string> = {
  linking: '#A78BFA',
  reduction: '#FBBF24',
  flapping: '#E879F9',
  assimilation: '#2DD4BF',
  palatalization: '#F472B6',
  elision: '#A3E635',
  intrusion: '#F87171',
  'weak-form': '#94A3B8',
};

export function getLinkingColor(type: LessonLinkingNote['type'], scheme: AppColorScheme): string {
  return scheme === 'dark' ? LINKING_COLORS_DARK[type] : LINKING_COLORS[type];
}

export const LINKING_DESCRIPTIONS: Record<LessonLinkingNote['type'], string> = {
  linking: '前の語尾と次の語頭がつながって発音されます',
  reduction: '一部の音が弱くなったり短く省略されたりします',
  flapping: 't や d の音が軽く弾く「ラ行」に近い音になります',
  assimilation: '前後の音が影響し合って別の音に変化します',
  palatalization: 't/d/s/z と you 等が合わさり「チュ/ジュ」等に変わります',
  elision: '会話の流れの中で特定の子音が抜け落ちます',
  intrusion: '語と語のつなぎ目に滑らかにする音が入ります',
  'weak-form': '代名詞や前置詞などが短く弱く発音されます',
};

/**
 * 色以外の手がかり (Issue #45 C2)。種類ごとに下線の形状・取り消し線・
 * イタリック・背景色を変え、色が判別できなくても種類を区別できるようにする。
 * textDecorationStyle は iOS のみ対応 (Android では実線の下線にフォールバックする)。
 */
export const LINKING_TEXT_DECORATIONS: Record<
  LessonLinkingNote['type'],
  import('react-native').TextStyle
> = {
  linking: { textDecorationLine: 'underline', textDecorationStyle: 'solid' },
  reduction: { textDecorationLine: 'underline', textDecorationStyle: 'dotted' },
  flapping: { textDecorationLine: 'underline', textDecorationStyle: 'dashed' },
  assimilation: { textDecorationLine: 'underline', textDecorationStyle: 'double' },
  palatalization: {
    textDecorationLine: 'underline',
    textDecorationStyle: 'solid',
    fontStyle: 'italic',
  },
  elision: { textDecorationLine: 'line-through', textDecorationStyle: 'solid' },
  intrusion: { backgroundColor: '#B91C1C26' },
  'weak-form': {
    textDecorationLine: 'underline',
    textDecorationStyle: 'dotted',
    fontStyle: 'italic',
  },
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
  // トークン (単語) の文字範囲を求める
  const tokens: { start: number; end: number }[] = [];
  let cursor = 0;
  for (const token of sentence.text.split(/\s+/)) {
    if (token.length === 0) {
      continue;
    }
    const start = sentence.text.indexOf(token, cursor);
    tokens.push({ start, end: start + token.length });
    cursor = start + token.length;
  }
  // span は「単語境界に一致するトークン列」にのみマッチさせる
  // (indexOf の部分文字列一致だと "to" が "stopped" の中に一致してしまうため)。
  // 複数語の span (例: "could you") は連続するトークン列の範囲一致で扱う。
  sentence.linking.forEach((note, noteIndex) => {
    for (let i = 0; i < tokens.length; i++) {
      for (let j = i; j < tokens.length; j++) {
        const candidate = sentence.text.slice(tokens[i].start, tokens[j].end);
        if (candidate === note.span) {
          for (let k = i; k <= j; k++) {
            if (map[k] === null) {
              map[k] = noteIndex;
            }
          }
          return;
        }
        if (candidate.length > note.span.length) {
          break; // この開始点では長くなる一方なので次へ
        }
      }
    }
  });
  return map;
}
