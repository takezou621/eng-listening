/** モックデータの型定義。本実装ではコンテンツパイプライン (#1–#3) の出力スキーマと揃える */

export type ContentType = 'conversation' | 'monologue';
export type ContentLevel = 'beginner' | 'intermediate';

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
