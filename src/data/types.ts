/** モックデータの型定義。本実装ではコンテンツパイプライン (#1–#3) の出力スキーマと揃える */

export type ContentType = 'conversation' | 'monologue';
export type ContentLevel = 'beginner' | 'intermediate';

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  conversation: '会話',
  monologue: 'モノローグ',
};

const CONTENT_TYPES: ReadonlySet<string> = new Set(['conversation', 'monologue']);
const CONTENT_LEVELS: ReadonlySet<string> = new Set(['beginner', 'intermediate']);

/** 1文ごとのタイムスタンプ (カラオケ表示・文単位リピートの土台) */
export interface Sentence {
  index: number;
  startSec: number;
  endSec: number;
  text: string;
  translationJa: string;
}

export interface LearningContent {
  id: string;
  title: string;
  titleJa: string;
  type: ContentType;
  level: ContentLevel;
  category: string;
  durationSec: number;
  /** 'bundled-spike-sample' はスパイク用にバンドルした音声。null は音声未接続のモック */
  audioSource: 'bundled-spike-sample' | null;
  sentences: Sentence[];
}

export interface WeakPhrase {
  id: string;
  text: string;
  translationJa: string;
  noteJa: string;
  contentId: string;
  savedAt: string;
}

/** JSON モックは型アサーションで読むため、読み込み時に検証して不正データは起動時に落とす */
export function assertValidContents(contents: LearningContent[]): void {
  if (contents.length === 0) {
    throw new Error('モックコンテンツが空です');
  }
  for (const content of contents) {
    if (
      !content.id ||
      !content.title ||
      !CONTENT_TYPES.has(content.type) ||
      !CONTENT_LEVELS.has(content.level) ||
      !Array.isArray(content.sentences)
    ) {
      throw new Error(`不正なモックコンテンツ: id=${String(content.id)}, type=${String(content.type)}`);
    }
    for (const sentence of content.sentences) {
      if (
        typeof sentence.startSec !== 'number' ||
        typeof sentence.endSec !== 'number' ||
        sentence.startSec >= sentence.endSec
      ) {
        throw new Error(`不正なタイムスタンプ: contentId=${content.id}, index=${String(sentence.index)}`);
      }
    }
  }
}
