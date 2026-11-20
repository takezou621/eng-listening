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

// インメモリのキャッシュ
let cachedData: UserData = { ...defaultData };
let isLoaded = false;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

async function save() {
  try {
    STORAGE_FILE.write(JSON.stringify(cachedData));
  } catch (e) {
    console.error('Failed to save user data:', e);
  }
}

export async function loadUserDataAsync() {
  if (isLoaded) return;
  try {
    if (STORAGE_FILE.exists) {
      const json = await STORAGE_FILE.text();
      cachedData = JSON.parse(json);
      // マイグレーション用 (将来用)
      cachedData.favoriteLessons ??= [];
      cachedData.weakSentences ??= [];
    }
  } catch (e) {
    console.error('Failed to load user data:', e);
  } finally {
    isLoaded = true;
    notify();
  }
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
      const isFav = cachedData.favoriteLessons.includes(lessonId);
      if (isFav) {
        cachedData.favoriteLessons = cachedData.favoriteLessons.filter((id) => id !== lessonId);
      } else {
        cachedData.favoriteLessons = [...cachedData.favoriteLessons, lessonId];
      }
      notify();
      void save();
    },
    isLessonFavorite: (lessonId: string) => cachedData.favoriteLessons.includes(lessonId),
    toggleWeakSentence: (lessonId: string, sentenceIndex: number) => {
      const isWeak = cachedData.weakSentences.some(
        (s) => s.lessonId === lessonId && s.sentenceIndex === sentenceIndex
      );
      if (isWeak) {
        cachedData.weakSentences = cachedData.weakSentences.filter(
          (s) => !(s.lessonId === lessonId && s.sentenceIndex === sentenceIndex)
        );
      } else {
        cachedData.weakSentences = [
          { lessonId, sentenceIndex, addedAtMs: Date.now() },
          ...cachedData.weakSentences,
        ];
      }
      notify();
      void save();
    },
    isSentenceWeak: (lessonId: string, sentenceIndex: number) =>
      cachedData.weakSentences.some((s) => s.lessonId === lessonId && s.sentenceIndex === sentenceIndex),
  };
}
