import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { useUserData } from '../library/userStore';
import { getLessonList, type LessonBundle } from '../lesson/registry';
import {
  computeStreakWithFreeze,
  localDateStr,
  useProgressData,
} from '../progress/progressStore';
import { pushWatchLibrary } from './watchSync';

/** 現在のローカル日付キー。アプリを開いたまま日付をまたいでも「今日」が
 *  古くならないよう、フォアグラウンド復帰と1分間隔で更新する (進捗タブと同じ方式)。 */
function useTodayKey(): string {
  const [todayKey, setTodayKey] = useState(localDateStr);
  useEffect(() => {
    const refresh = () => setTodayKey(localDateStr());
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    const interval = setInterval(refresh, 60_000);
    return () => {
      sub.remove();
      clearInterval(interval);
    };
  }, []);
  return todayKey;
}

/**
 * Apple Watch へ「今日の進捗 + 苦手フレーズ」を送り続ける常駐コンポーネント。
 * 進捗ストア・ユーザーストア・日付のいずれかが変わるたびに最新状態を送る
 * (表示は持たない)。
 */
export function WatchLibrarySync(): null {
  const progress = useProgressData();
  const user = useUserData();
  const todayKey = useTodayKey();

  useEffect(() => {
    const todayRecord = progress[todayKey];
    // 苦手フレーズは新しい順 (ストアは新しい順に保持する)。並びが崩れた
    // 保存データでも新しい順になるよう addedAtMs 降順に並べ直して先頭20件を送る。
    // 未知のレッスン ID は getLessonBundle がデフォルトレッスンに化けるため、
    // 一覧に実在するレッスンの文だけを対象にする。
    const bundles = new Map<string, LessonBundle>();
    for (const item of getLessonList()) {
      if (item.bundle) bundles.set(item.entry.id, item.bundle);
    }
    const phrases = [...user.weakSentences]
      .sort((a, b) => b.addedAtMs - a.addedAtMs)
      .slice(0, 20)
      .flatMap((weak) => {
        const sentence = bundles.get(weak.lessonId)?.data.sentences[weak.sentenceIndex];
        return sentence ? [{ textEn: sentence.text, textJa: sentence.translationJa }] : [];
      });
    pushWatchLibrary({
      todaySeconds: Math.floor(todayRecord?.seconds ?? 0),
      streakDays: computeStreakWithFreeze(progress).streak,
      todayCompletedCount: todayRecord?.completedLessons.length ?? 0,
      phrases,
    });
  }, [progress, user, todayKey]);

  return null;
}

export default WatchLibrarySync;
