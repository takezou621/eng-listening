/**
 * コンテンツパイプライン (tools/content/) が生成するレッスン JSON の型。
 *
 * 出力物: assets/lessons/<id>/lesson.json + audio.m4a
 * 生成方法は docs/content-pipeline.md を参照。
 */

export interface LessonWord {
  /** 台本の単語 (表記は台本が正。whisper はタイムスタンプのみに使用) */
  text: string;
  startSec: number;
  endSec: number;
}

/** スラッシュ (チャンク) 表示用の区切り */
export interface LessonChunk {
  text: string;
  startSec: number;
  endSec: number;
}

/** 音の変化 (リンキング・リダクション等) の注釈。表示は Issue #7 */
export interface LessonLinkingNote {
  span: string;
  type: 'linking' | 'reduction' | 'flapping' | 'palatalization' | 'assimilation';
  ipa: string;
  noteJa: string;
}

export interface LessonSentence {
  index: number;
  /** voice_config.json の voices キー (female / male / narrator) */
  speaker: string;
  startSec: number;
  endSec: number;
  text: string;
  translationJa: string;
  chunks: LessonChunk[];
  words: LessonWord[];
  linking: LessonLinkingNote[];
}

export interface LessonData {
  id: string;
  title: string;
  titleJa: string;
  type: 'conversation' | 'monologue';
  level: 'beginner' | 'intermediate';
  category: string;
  /** レッスン JSON と同じディレクトリにある音声ファイル名 */
  audio: string;
  durationSec: number;
  speakerNames: Record<string, string>;
  /** 生成に使った voice_config.json のハッシュ (混在防止) */
  configHash: string;
  engine: string;
  voices: Record<string, string>;
  generatedAtUtc: string;
  sentences: LessonSentence[];
}

/** 読み込み時に検証し、不正な生成物は起動時に落とす (モックデータと同じ方針) */
export function assertValidLesson(lesson: LessonData): void {
  if (!lesson.id || !lesson.title || !Array.isArray(lesson.sentences) || lesson.sentences.length === 0) {
    throw new Error(`不正なレッスン JSON: id=${String(lesson.id)}`);
  }
  let prevEnd = -1;
  for (const sentence of lesson.sentences) {
    // Number.isFinite で NaN / Infinity を弾く (typeof NaN === 'number' のため)
    if (
      !Number.isFinite(sentence.startSec) ||
      !Number.isFinite(sentence.endSec) ||
      sentence.startSec >= sentence.endSec ||
      sentence.startSec < prevEnd
    ) {
      throw new Error(`不正なタイムスタンプ: lesson=${lesson.id}, index=${String(sentence.index)}`);
    }
    prevEnd = sentence.endSec;
    if (!Array.isArray(sentence.words) || sentence.words.length === 0) {
      throw new Error(`単語タイムスタンプがありません: lesson=${lesson.id}, index=${String(sentence.index)}`);
    }
    for (const word of sentence.words) {
      if (!Number.isFinite(word.startSec) || !Number.isFinite(word.endSec) || word.startSec > word.endSec) {
        throw new Error(
          `不正な単語タイムスタンプ: lesson=${lesson.id}, index=${String(sentence.index)}, word=${word.text}`
        );
      }
    }
  }
}
