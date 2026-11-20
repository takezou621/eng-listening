/**
 * シャドーイング録音の回数カウント (Issue #10)。
 * アプリ再起動まで保持する in-memory ストア (永続化は Issue #13 の進捗可視化で扱う)。
 * 録音データそのものは保持せず、回数のみ。
 */

const counts: Record<string, Record<number, number>> = {};

/** レッスン内の文ごとの録音回数 (index = sentence.index) */
export function getShadowingCounts(lessonId: string): Record<number, number> {
  return counts[lessonId] ?? {};
}

/** 録音 1 回を記録し、更新後の文ごとの回数を返す */
export function addShadowingCount(lessonId: string, sentenceIndex: number): Record<number, number> {
  const per = (counts[lessonId] ??= {});
  per[sentenceIndex] = (per[sentenceIndex] ?? 0) + 1;
  return { ...per };
}

/** レッスン全体の録音合計 */
export function lessonShadowingTotal(lessonId: string): number {
  return Object.values(counts[lessonId] ?? {}).reduce((sum, n) => sum + n, 0);
}
