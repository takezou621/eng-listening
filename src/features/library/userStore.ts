import { Paths, File } from 'expo-file-system';
import { useEffect, useState } from 'react';

/**
 * お気に入りレッスンと苦手フレーズ(文単位)の永続化ストア。
 * 端末内 (expo-file-system の Document ディレクトリ) に JSON で保存し、
 * アカウント同期は行わない (MVP スコープ)。
 */

const STORAGE_FILE = new File(Paths.document, 'user-data.json');

interface UserData {
  favoriteLessons: string[]; // お気に入り登録した lessonId の配列
  weakSentences: WeakSentence[];
}

export interface WeakSentence {
  lessonId: string;
  sentenceIndex: number;
  addedAtMs: number;
}

const defaultData: UserData = {
  favoriteLessons: [],
  weakSentences: [],
};

// インメモリのキャッシュ。変更時は必ず新しい参照を作る (React の再描画検知のため)
let cachedData: UserData = { ...defaultData };
let isLoaded = false;
let loadPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

/** JSON 文字列を検証して UserData に変換する (不正な形は既定値にフォールバック) */
function parseUserData(json: string): UserData {
  const parsed: unknown = JSON.parse(json);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ...defaultData };
  }
  const obj = parsed as Partial<UserData>;
  return {
    favoriteLessons: Array.isArray(obj.favoriteLessons)
      ? obj.favoriteLessons.filter((id) => typeof id === 'string')
      : [],
    weakSentences: Array.isArray(obj.weakSentences)
      ? obj.weakSentences.filter(
          (s): s is WeakSentence =>
            typeof s === 'object' &&
            s !== null &&
            typeof s.lessonId === 'string' &&
            typeof s.sentenceIndex === 'number' &&
            typeof s.addedAtMs === 'number'
        )
      : [],
  };
}

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

/** 変更は必ずこの関数経由で行い、新しい参照を通知する */
function updateUserData(mutate: (current: UserData) => UserData) {
  cachedData = mutate(cachedData);
  notify();
  STORAGE_FILE.write(JSON.stringify(cachedData));
}

/** 読み込みは 1 回だけ実行し、並走呼び出しを dedupe する (Promise をキャッシュ) */
export function loadUserDataAsync(): Promise<void> {
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        if (STORAGE_FILE.exists) {
          const parsed = parseUserData(await STORAGE_FILE.text());
          // 読み込み待ち中のトグル操作を上書きで消さないようマージする
          updateUserData((current) => ({
            favoriteLessons:
              current.favoriteLessons.length > 0 ? current.favoriteLessons : parsed.favoriteLessons,
            weakSentences:
              current.weakSentences.length > 0 ? current.weakSentences : parsed.weakSentences,
          }));
        }
      } catch (e) {
        console.error('Failed to load user data:', e);
      } finally {
        isLoaded = true;
        notify();
      }
    })();
  }
  return loadPromise;
}

export function useUserData() {
  const [data, setData] = useState(cachedData);

  useEffect(() => {
    if (!isLoaded) {
      void loadUserDataAsync();
    }
    const listener = () => setData(cachedData);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return {
    ...data,
    toggleFavoriteLesson: (lessonId: string) => {
      updateUserData((current) => {
        const isFav = current.favoriteLessons.includes(lessonId);
        return {
          ...current,
          favoriteLessons: isFav
            ? current.favoriteLessons.filter((id) => id !== lessonId)
            : [...current.favoriteLessons, lessonId],
        };
      });
    },
    isLessonFavorite: (lessonId: string) => data.favoriteLessons.includes(lessonId),
    toggleWeakSentence: (lessonId: string, sentenceIndex: number) => {
      updateUserData((current) => {
        const isWeak = current.weakSentences.some(
          (s) => s.lessonId === lessonId && s.sentenceIndex === sentenceIndex
        );
        return {
          ...current,
          weakSentences: isWeak
            ? current.weakSentences.filter(
                (s) => !(s.lessonId === lessonId && s.sentenceIndex === sentenceIndex)
              )
            : [{ lessonId, sentenceIndex, addedAtMs: Date.now() }, ...current.weakSentences],
        };
      });
    },
    isSentenceWeak: (lessonId: string, sentenceIndex: number) =>
      data.weakSentences.some(
        (s) => s.lessonId === lessonId && s.sentenceIndex === sentenceIndex
      ),
  };
}
