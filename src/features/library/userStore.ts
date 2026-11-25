import { Paths, File } from 'expo-file-system';
import { useEffect, useState } from 'react';

import { logEvent } from '../analytics/analyticsStore';
import {
  CURRICULUM_FOCUS_TYPES,
  MAX_CURRICULUM_FOCUS_TYPES,
  isCurriculumCustomizationActive,
  type CurriculumCustomization,
  type CurriculumLevelFilter,
  type LinkingNoteType,
} from '../learning/curriculum';
import {
  applyReviewOutcome,
  isWeakGraduated,
  reactivateGraduated,
  type ReviewScheduleFields,
} from '../learning/spacedRepetition';

/**
 * お気に入りレッスン・苦手フレーズ(文単位)・1日の学習目標の永続化ストア。
 * 端末内 (expo-file-system の Document ディレクトリ) に JSON で保存し、
 * アカウント同期は行わない (MVP スコープ)。
 */

const STORAGE_FILE = new File(Paths.document, 'user-data.json');

export type DailyGoalMinutes = 3 | 5 | 10 | 15;

export const DAILY_GOAL_OPTIONS: readonly {
  minutes: DailyGoalMinutes;
  title: string;
  hint: string;
}[] = [
  { minutes: 3, title: '3分 / 日', hint: '1本めやす・気軽に毎日' },
  { minutes: 5, title: '5分 / 日', hint: '1〜2本・おすすめ' },
  { minutes: 10, title: '10分 / 日', hint: '2〜3本・しっかり定着' },
  { minutes: 15, title: '15分 / 日', hint: '集中トレーニング' },
];

export const DEFAULT_DAILY_GOAL_MINUTES: DailyGoalMinutes = 3;

function parseGoalMinutes(value: unknown): DailyGoalMinutes {
  if (value === 3 || value === 5 || value === 10 || value === 15) {
    return value;
  }
  return DEFAULT_DAILY_GOAL_MINUTES;
}

export interface SavedDiagnosticProfile {
  completedAtMs: number;
  score: number;
  total: number;
  missedTypes: Record<string, number>;
  recommendedLessonId: string | null;
}

interface UserData {
  favoriteLessons: string[]; // お気に入り登録した lessonId の配列
  weakSentences: WeakSentence[];
  /** 初回オンボーディング診断 (またはスキップ) を完了したか */
  onboardingDone: boolean;
  /** 1日の学習目標 (分) */
  dailyGoalMinutes: DailyGoalMinutes;
  /** 直近の診断結果プロフィール (カリキュラムとホーム推薦の接続用・任意) */
  diagnosticProfile?: SavedDiagnosticProfile;
  /** カリキュラムの手動カスタマイズ (重点タイプ・難易度)。未設定 = 自動おすすめ */
  curriculumCustom?: CurriculumCustomization;
}

export interface WeakSentence extends ReviewScheduleFields {
  lessonId: string;
  sentenceIndex: number;
  addedAtMs: number;
}

const defaultData: UserData = {
  favoriteLessons: [],
  weakSentences: [],
  onboardingDone: false,
  dailyGoalMinutes: DEFAULT_DAILY_GOAL_MINUTES,
};

// インメモリのキャッシュ。変更時は必ず新しい参照を作る (React の再描画検知のため)
let cachedData: UserData = { ...defaultData };
let isLoaded = false;
let loadPromise: Promise<void> | null = null;
let dailyGoalCustomized = false;
const listeners = new Set<() => void>();

function parseOptionalFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function parseDiagnosticProfile(raw: unknown): SavedDiagnosticProfile | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined;
  const p = raw as Partial<SavedDiagnosticProfile>;
  if (
    typeof p.completedAtMs !== 'number' ||
    !Number.isFinite(p.completedAtMs) ||
    typeof p.score !== 'number' ||
    !Number.isFinite(p.score) ||
    typeof p.total !== 'number' ||
    !Number.isFinite(p.total)
  ) {
    return undefined;
  }
  const missedTypes: Record<string, number> = {};
  if (typeof p.missedTypes === 'object' && p.missedTypes !== null && !Array.isArray(p.missedTypes)) {
    for (const [k, v] of Object.entries(p.missedTypes)) {
      if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
        missedTypes[k] = v;
      }
    }
  }
  return {
    completedAtMs: p.completedAtMs,
    score: p.score,
    total: p.total,
    missedTypes,
    recommendedLessonId: typeof p.recommendedLessonId === 'string' ? p.recommendedLessonId : null,
  };
}

/**
 * 保存された手動カスタマイズを検証する。
 * focusTypes は文字列配列のみ受け付け (有効タイプのみ保持・重複排除・最大 3 個)、
 * levelFilter は定義外なら 'all'。無効内容 (空 + 'all') や不正な形は
 * undefined (= 保存しない・自動おすすめ) にフォールバックする (旧データ互換)。
 */
function parseCurriculumCustom(raw: unknown): CurriculumCustomization | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined;
  const r = raw as Partial<CurriculumCustomization>;
  const seen = new Set<LinkingNoteType>();
  const focusTypes: LinkingNoteType[] = [];
  if (Array.isArray(r.focusTypes)) {
    for (const item of r.focusTypes as unknown[]) {
      if (typeof item !== 'string') continue;
      const t = item as LinkingNoteType;
      if (!CURRICULUM_FOCUS_TYPES.includes(t) || seen.has(t)) continue;
      seen.add(t);
      focusTypes.push(t);
      if (focusTypes.length >= MAX_CURRICULUM_FOCUS_TYPES) break;
    }
  }
  const levelFilter: CurriculumLevelFilter =
    r.levelFilter === 'beginner' || r.levelFilter === 'intermediate' ? r.levelFilter : 'all';
  const custom: CurriculumCustomization = { focusTypes, levelFilter };
  return isCurriculumCustomizationActive(custom) ? custom : undefined;
}

/** JSON 文字列を検証して UserData に変換する (不正な形は既定値にフォールバック・旧データ互換) */
function parseUserData(json: string): UserData {
  const parsed: unknown = JSON.parse(json);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ...defaultData };
  }
  const obj = parsed as Partial<UserData>;
  const weakSentences: WeakSentence[] = Array.isArray(obj.weakSentences)
    ? obj.weakSentences
        .filter(
          (s): s is WeakSentence =>
            typeof s === 'object' &&
            s !== null &&
            typeof s.lessonId === 'string' &&
            typeof s.sentenceIndex === 'number' &&
            typeof s.addedAtMs === 'number'
        )
        .map((s) => ({
          lessonId: s.lessonId,
          sentenceIndex: s.sentenceIndex,
          addedAtMs: s.addedAtMs,
          reviewStage: parseOptionalFiniteNumber(s.reviewStage),
          nextReviewAtMs: parseOptionalFiniteNumber(s.nextReviewAtMs),
          lastReviewedAtMs: parseOptionalFiniteNumber(s.lastReviewedAtMs),
          consecutiveSuccesses: parseOptionalFiniteNumber(s.consecutiveSuccesses),
          reviewCount: parseOptionalFiniteNumber(s.reviewCount),
          graduatedAtMs: parseOptionalFiniteNumber(s.graduatedAtMs),
        }))
    : [];
  return {
    onboardingDone: obj.onboardingDone === true,
    dailyGoalMinutes: parseGoalMinutes(obj.dailyGoalMinutes),
    favoriteLessons: Array.isArray(obj.favoriteLessons)
      ? obj.favoriteLessons.filter((id) => typeof id === 'string')
      : [],
    weakSentences,
    diagnosticProfile: parseDiagnosticProfile(obj.diagnosticProfile),
    curriculumCustom: parseCurriculumCustom(obj.curriculumCustom),
  };
}

/** 苦手フレーズをマージする (復習進捗が多い方を優先、未復習同士なら登録が古い方を優先) */
function mergeWeakSentences(
  base: WeakSentence[],
  override: WeakSentence[]
): WeakSentence[] {
  const byKey = new Map<string, WeakSentence>();
  for (const s of [...base, ...override]) {
    const key = `${s.lessonId}:${s.sentenceIndex}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, s);
      continue;
    }
    const sCount = s.reviewCount ?? 0;
    const eCount = existing.reviewCount ?? 0;
    if (
      sCount > eCount ||
      (sCount === eCount && (s.lastReviewedAtMs ?? 0) > (existing.lastReviewedAtMs ?? 0)) ||
      (sCount === eCount &&
        (s.lastReviewedAtMs ?? 0) === (existing.lastReviewedAtMs ?? 0) &&
        s.addedAtMs < existing.addedAtMs)
    ) {
      byKey.set(key, {
        ...s,
        addedAtMs: Math.min(s.addedAtMs, existing.addedAtMs),
      });
    }
  }
  return [...byKey.values()].sort((a, b) => b.addedAtMs - a.addedAtMs);
}

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

let canPersist = false;
let saveQueue: Promise<void> = Promise.resolve();

/** 読み込み完了後に保留中の書き込みを実行する */
function flushPendingSave() {
  saveQueue = saveQueue.then(async () => {
    if (!canPersist) return;
    try {
      await STORAGE_FILE.write(JSON.stringify(cachedData));
    } catch (e) {
      console.error('Failed to save user data:', e);
    }
  });
}

/** 変更は必ずこの関数経由で行い、新しい参照を通知する */
function updateUserData(mutate: (current: UserData) => UserData) {
  cachedData = mutate(cachedData);
  notify();
  if (canPersist) {
    flushPendingSave();
  }
}

/** 読み込みは 1 回だけ実行し、並走呼び出しを dedupe する (Promise をキャッシュ) */
export function loadUserDataAsync(): Promise<void> {
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        if (STORAGE_FILE.exists) {
          const parsed = parseUserData(await STORAGE_FILE.text());
          updateUserData((current) => ({
            onboardingDone: current.onboardingDone || parsed.onboardingDone,
            dailyGoalMinutes: dailyGoalCustomized
              ? current.dailyGoalMinutes
              : parsed.dailyGoalMinutes,
            favoriteLessons: Array.from(
              new Set([...current.favoriteLessons, ...parsed.favoriteLessons])
            ),
            weakSentences: mergeWeakSentences(parsed.weakSentences, current.weakSentences),
            diagnosticProfile: current.diagnosticProfile ?? parsed.diagnosticProfile,
            curriculumCustom: current.curriculumCustom ?? parsed.curriculumCustom,
          }));
        }
        canPersist = true;
        flushPendingSave();
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

/** 読み込み後の最新の完了状態を取得する (マウント時クロージャの古い値を避ける) */
export function isOnboardingDone(): boolean {
  return cachedData.onboardingDone;
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
    setDailyGoalMinutes: (minutes: DailyGoalMinutes) => {
      dailyGoalCustomized = true;
      updateUserData((current) => ({ ...current, dailyGoalMinutes: minutes }));
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
    /** 初回診断・再診断の結果プロフィールを保存する (カリキュラムとホーム推薦を連携) */
    saveDiagnosticProfile: (profile: SavedDiagnosticProfile) => {
      updateUserData((current) => ({ ...current, diagnosticProfile: profile }));
    },
    /** カリキュラムの手動カスタマイズを保存する (null・無効内容は削除して自動おすすめへ戻す)。
     *  関数を渡すと直近の保存値から次の値を計算する (連続タップ時の古い値ベースの上書きを防ぐ) */
    setCurriculumCustom: (
      value:
        | CurriculumCustomization
        | null
        | ((prev: CurriculumCustomization | null) => CurriculumCustomization | null)
    ) => {
      updateUserData((current) => {
        const prev = current.curriculumCustom ?? null;
        const custom = typeof value === 'function' ? value(prev) : value;
        if (custom === null || !isCurriculumCustomizationActive(custom)) {
          const { curriculumCustom: _removed, ...rest } = current;
          return rest;
        }
        return { ...current, curriculumCustom: custom };
      });
    },
    /** 初回診断で聞き取れなかった文を苦手フレーズ帳へ一括自動登録する (既登録分はスキップ) */
    addWeakSentencesFromDiagnostic: (items: { lessonId: string; sentenceIndex: number }[]) => {
      if (items.length === 0) return;
      updateUserData((current) => {
        const existingKeys = new Set(
          current.weakSentences.map((s) => `${s.lessonId}:${s.sentenceIndex}`)
        );
        const now = Date.now();
        const added: WeakSentence[] = [];
        items.forEach((item, idx) => {
          const key = `${item.lessonId}:${item.sentenceIndex}`;
          if (!existingKeys.has(key)) {
            existingKeys.add(key);
            added.push({
              lessonId: item.lessonId,
              sentenceIndex: item.sentenceIndex,
              addedAtMs: now - idx,
              reviewStage: 0,
              nextReviewAtMs: now,
            });
          }
        });
        if (added.length === 0) return current;
        return {
          ...current,
          weakSentences: [...added, ...current.weakSentences],
        };
      });
    },
    toggleWeakSentence: (lessonId: string, sentenceIndex: number) => {
      // 追加か削除かは現在の状態で判定し、計測イベントを分ける
      const isWeak = data.weakSentences.some(
        (s) => s.lessonId === lessonId && s.sentenceIndex === sentenceIndex
      );
      const now = Date.now();
      updateUserData((current) => {
        const exists = current.weakSentences.some(
          (s) => s.lessonId === lessonId && s.sentenceIndex === sentenceIndex
        );
        return {
          ...current,
          weakSentences: exists
            ? current.weakSentences.filter(
                (s) => !(s.lessonId === lessonId && s.sentenceIndex === sentenceIndex)
              )
            : [
                {
                  lessonId,
                  sentenceIndex,
                  addedAtMs: now,
                  reviewStage: 0,
                  nextReviewAtMs: now,
                },
                ...current.weakSentences,
              ],
        };
      });
      logEvent(isWeak ? 'weak_phrase_removed' : 'weak_phrase_added', { lessonId });
    },
    /** 復習キューでの自己想起判定 (聞き取れた / もう一度) を記録する */
    recordWeakSentenceReview: (
      lessonId: string,
      sentenceIndex: number,
      remembered: boolean
    ) => {
      const target = cachedData.weakSentences.find(
        (s) => s.lessonId === lessonId && s.sentenceIndex === sentenceIndex
      );
      if (!target) return;
      const wasGraduated = isWeakGraduated(target);
      const now = Date.now();
      const updated = applyReviewOutcome(target, remembered, now);
      updateUserData((current) => ({
        ...current,
        weakSentences: current.weakSentences.map((s) =>
          s.lessonId === lessonId && s.sentenceIndex === sentenceIndex ? updated : s
        ),
      }));
      logEvent('weak_phrase_reviewed', {
        lessonId,
        remembered,
        stage: updated.reviewStage ?? 0,
      });
      if (!wasGraduated && isWeakGraduated(updated)) {
        logEvent('weak_phrase_graduated', {
          lessonId,
          reviewCount: updated.reviewCount ?? 1,
        });
      }
    },
    /** 卒業済みフレーズを復習キューへ戻す */
    reactivateWeakSentence: (lessonId: string, sentenceIndex: number) => {
      const now = Date.now();
      updateUserData((current) => ({
        ...current,
        weakSentences: current.weakSentences.map((s) =>
          s.lessonId === lessonId && s.sentenceIndex === sentenceIndex
            ? reactivateGraduated(s, now)
            : s
        ),
      }));
    },
    isSentenceWeak: (lessonId: string, sentenceIndex: number) =>
      data.weakSentences.some(
        (s) => s.lessonId === lessonId && s.sentenceIndex === sentenceIndex
      ),
  };
}
