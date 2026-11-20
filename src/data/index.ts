import contentsJson from './mock/contents.json';
import phrasesJson from './mock/phrases.json';
import { assertValidContents, type LearningContent, type Sentence, type WeakPhrase } from './types';

/** 初期コンテンツは GM 決定どおり 12 本 (会話8 + モノローグ4) のモック。読み込み時に検証する */
export const CONTENTS = contentsJson.contents as LearningContent[];
assertValidContents(CONTENTS);

export const WEAK_PHRASES = phrasesJson.phrases as WeakPhrase[];

export function getContentById(id: string): LearningContent | undefined {
  return CONTENTS.find((content) => content.id === id);
}

export function sentencesOf(content: LearningContent): Sentence[] {
  return content.sentences;
}
