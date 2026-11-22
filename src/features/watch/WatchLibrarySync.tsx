import { useEffect } from 'react';

import { getLessonBundle } from '@/features/lesson/registry';
import { useUserData } from '@/features/library/userStore';
import {
  computeStreakWithFreeze,
  localDateStr,
  useProgressData,
} from '@/features/progress/progressStore';
import { pushWatchLibrary, type WatchPhraseItem } from './watchSync';

/**
 * 進捗と苦手フレーズを Apple Watch に同期する (描画なしコンポーネント)。
 * ルートレイアウトに常駐し、ストアの変更たびに最新状態を送る。
 * Watch が未ペアリングの環境では送信が静かに失敗するだけで影響はない。
 */
export function WatchLibrarySync() {
  const progress = useProgressData();
  const user = useUserData();

  useEffect(() => {
    const todayRecord = progress[localDateStr()];
    const phrases: WatchPhraseItem[] = user.weakSentences
      .slice(-20)
      .reverse()
      .flatMap((weak) => {
        try {
          const sentence = getLessonBundle(weak.lessonId).data.sentences[
            weak.sentenceIndex
          ];
          if (!sentence) return [];
          return [{ textEn: sentence.text, textJa: sentence.translationJa }];
        } catch {
          return [];
        }
      });
    pushWatchLibrary({
      todaySeconds: Math.floor(todayRecord?.seconds ?? 0),
      streakDays: computeStreakWithFreeze(progress).streak,
      todayCompletedCount: todayRecord?.completedLessons.length ?? 0,
      phrases,
    });
  }, [progress, user]);

  return null;
}
