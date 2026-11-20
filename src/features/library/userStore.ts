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
  /** 初回オンボーディング診断 (またはスキップ) を完了したか */
  onboardingDone: boolean;
}

export interface WeakSentence {
  lessonId: string;
  sentenceIndex: number;
  addedAtMs: number;
}

const defaultData: UserData = {
  favoriteLessons: [],
  weakSentences: [],
  onboardingDone: false,
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
    onboardingDone: obj.onboardingDone === true,
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

/** 苦手フレーズをマージする (同一文は追加日時が古い方 = 登録当初の記録を優先) */
function mergeWeakSentences(
  base: WeakSentence[],
  override: WeakSentence[]
): WeakSentence[] {
  const byKey = new Map<string, WeakSentence>();
  for (const s of [...base, ...override]) {
    const key = `${s.lessonId}:${s.sentenceIndex}`;
    const existing = byKey.get(key);
    if (!existing || s.addedAtMs < existing.addedAtMs) {
      byKey.set(key, s);
    }
  }
  return [...byKey.values()];
}

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

// 読み込み完了前の保存は保存済みデータを消す恐れがあるため禁止し、
// 書き込みは前の書き込み完了後に直列実行する (競合で古い状態が残るのを防ぐ)
let canPersist = false;
let saveQueue: Promise<void> = Promise.resolve();

/** 変更は必ずこの関数経由で行い、新しい参照を通知する */
function updateUserData(mutate: (current: UserData) => UserData) {
  cachedData = mutate(cachedData);
  notify();
  saveQueue = saveQueue.then(async () => {
    if (!canPersist) return;
    try {
      await STORAGE_FILE.write(JSON.stringify(cachedData));
    } catch (e) {
      console.error('Failed to save user data:', e);
    }
  });
}

/** 読み込みは 1 回だけ実行し、並走呼び出しを dedupe する (Promise をキャッシュ) */
export function loadUserDataAsync(): Promise<void> {
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        if (STORAGE_FILE.exists) {
          const parsed = parseUserData(await STORAGE_FILE.text());
          // 読み込み待ち中のトグル操作を破棄しない。お気に入りはユニオン、
          // 苦手フレーズは文キーで dedupe して両側の登録を保持する
          updateUserData((current) => ({
            // 完了済みフラグは読み込み結果で false に戻さない (毎回オンボーディングに戻るのを防ぐ)
            onboardingDone: current.onboardingDone || parsed.onboardingDone,
            favoriteLessons: Array.from(
              new Set([...current.favoriteLessons, ...parsed.favoriteLessons])
            ),
            weakSentences: mergeWeakSentences(parsed.weakSentences, current.weakSentences),
          }));
        }
        // 読み込み成功時のみ保存を許可する (失敗時に既存ファイルを空データで
        // 上書きする経路を排除。PR #34 の progressStore と同じ方針)
        canPersist = true;
      } catch (e) {
        // 読み込み失敗時は canPersist を true にしない (既存ファイルの保護)
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
    /** オンボーディング完了 (またはスキップ) を記録し、次回以降は通常起動にする */
    completeOnboarding: () => {
      updateUserData((current) => ({ ...current, onboardingDone: true }));
    },
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
