/**
 * 忘却曲線に沿った間隔反復と卒業判定の純関数モデル (Phase 1-D + Phase 2 復習キュー共通基盤)。
 *
 * 段階設計 (Cepeda et al. 2006 / Roediger & Karpicke 2006 に基づく漸増間隔):
 * - ステージ 0: 未定着・要再挑戦 (「もう一度」時はステージ 0 にリセットし即復習対象へ)
 * - ステージ 1: 1 回成功 → 1 日後に再復習
 * - ステージ 2: 2 回連続成功 → 3 日後に再復習
 * - ステージ 3 (GRADUATION_STAGE): 3 回連続成功 (7 日サイクル完了相当) で「卒業 (定着)」
 *
 * 全フィールドは optional とし、既存の端末内 user-data.json との 100% 後方互換を保つ。
 */

export const DAY_MS = 24 * 60 * 60 * 1000;

/** 各ステージ完了時の次回までの復習間隔 (日数) */
export const REVIEW_INTERVAL_DAYS = [1, 3, 7] as const;

/** この回数連続して「聞き取れた」を達成すると卒業 (定着) とみなす */
export const GRADUATION_STAGE = 3;

export interface ReviewScheduleFields {
  /** 現在の定着ステージ (0..3)。3 以上で卒業扱い */
  reviewStage?: number;
  /** 次回復習予定時刻 (epoch ms)。未設定は即日復習対象 */
  nextReviewAtMs?: number;
  /** 最終復習時刻 (epoch ms) */
  lastReviewedAtMs?: number;
  /** 連続して「聞き取れた」と回答した回数 */
  consecutiveSuccesses?: number;
  /** 累計復習回数 */
  reviewCount?: number;
  /** 卒業 (定着) 達成時刻 (epoch ms) */
  graduatedAtMs?: number;
}

export function isWeakGraduated(item: ReviewScheduleFields): boolean {
  if (typeof item.graduatedAtMs === 'number' && item.graduatedAtMs > 0) {
    return true;
  }
  return (item.reviewStage ?? 0) >= GRADUATION_STAGE;
}

export function isWeakDueForReview(
  item: ReviewScheduleFields,
  nowMs: number = Date.now()
): boolean {
  if (isWeakGraduated(item)) return false;
  if (typeof item.nextReviewAtMs !== 'number' || !Number.isFinite(item.nextReviewAtMs)) {
    return true;
  }
  return item.nextReviewAtMs <= nowMs;
}

/**
 * 復習結果 (聞き取れた = true / もう一度 = false) を適用した新しいレコードを返す。
 * - remembered=true: ステージ +1。3 到達時は卒業。未卒業時は間隔 (1日→3日) 後に予約。
 * - remembered=false: ステージ 0 へリセットし、即日復習対象としてキューに戻す。
 */
export function applyReviewOutcome<T extends ReviewScheduleFields>(
  item: T,
  remembered: boolean,
  nowMs: number = Date.now()
): T {
  const prevStage = Math.max(0, Math.min(item.reviewStage ?? 0, GRADUATION_STAGE - 1));
  const reviewCount = (item.reviewCount ?? 0) + 1;

  if (!remembered) {
    return {
      ...item,
      reviewStage: 0,
      consecutiveSuccesses: 0,
      nextReviewAtMs: nowMs,
      lastReviewedAtMs: nowMs,
      reviewCount,
      graduatedAtMs: undefined,
    };
  }

  const nextStage = Math.min(prevStage + 1, GRADUATION_STAGE);
  const consecutiveSuccesses = (item.consecutiveSuccesses ?? 0) + 1;
  const graduated = nextStage >= GRADUATION_STAGE;

  if (graduated) {
    return {
      ...item,
      reviewStage: GRADUATION_STAGE,
      consecutiveSuccesses,
      lastReviewedAtMs: nowMs,
      nextReviewAtMs: undefined,
      reviewCount,
      graduatedAtMs: nowMs,
    };
  }

  const intervalDays = REVIEW_INTERVAL_DAYS[prevStage] ?? 1;
  return {
    ...item,
    reviewStage: nextStage,
    consecutiveSuccesses,
    lastReviewedAtMs: nowMs,
    nextReviewAtMs: nowMs + intervalDays * DAY_MS,
    reviewCount,
    graduatedAtMs: undefined,
  };
}

/** 卒業済みフレーズを復習キュー (ステージ 0・今日復習) に戻す */
export function reactivateGraduated<T extends ReviewScheduleFields>(
  item: T,
  nowMs: number = Date.now()
): T {
  return {
    ...item,
    reviewStage: 0,
    consecutiveSuccesses: 0,
    nextReviewAtMs: nowMs,
    graduatedAtMs: undefined,
  };
}

export interface ReviewQueueSummary<T extends ReviewScheduleFields> {
  /** 今日復習すべきアイテム (期限が古い順) */
  dueItems: T[];
  /** 後日復習予定のアイテム (予定が近い順) */
  upcomingItems: T[];
  /** 卒業 (定着) 済みアイテム (卒業が新しい順) */
  graduatedItems: T[];
  dueCount: number;
  upcomingCount: number;
  /** 未卒業の残数 (今日復習 + 後日予定) */
  activeCount: number;
  graduatedCount: number;
}

export function summarizeReviewQueue<T extends ReviewScheduleFields & { addedAtMs: number }>(
  items: readonly T[],
  nowMs: number = Date.now()
): ReviewQueueSummary<T> {
  const dueItems: T[] = [];
  const upcomingItems: T[] = [];
  const graduatedItems: T[] = [];

  for (const item of items) {
    if (isWeakGraduated(item)) {
      graduatedItems.push(item);
    } else if (isWeakDueForReview(item, nowMs)) {
      dueItems.push(item);
    } else {
      upcomingItems.push(item);
    }
  }

  dueItems.sort(
    (a, b) => (a.nextReviewAtMs ?? a.addedAtMs) - (b.nextReviewAtMs ?? b.addedAtMs)
  );
  upcomingItems.sort(
    (a, b) => (a.nextReviewAtMs ?? Number.MAX_SAFE_INTEGER) - (b.nextReviewAtMs ?? Number.MAX_SAFE_INTEGER)
  );
  graduatedItems.sort((a, b) => (b.graduatedAtMs ?? 0) - (a.graduatedAtMs ?? 0));

  return {
    dueItems,
    upcomingItems,
    graduatedItems,
    dueCount: dueItems.length,
    upcomingCount: upcomingItems.length,
    activeCount: dueItems.length + upcomingItems.length,
    graduatedCount: graduatedItems.length,
  };
}

/** ユーザー画面に表示する簡潔な復習ステータス (P5: 生時刻や内部 ID を出さない) */
export function formatReviewStatusLabel(
  item: ReviewScheduleFields,
  nowMs: number = Date.now()
): string {
  if (isWeakGraduated(item)) {
    return '卒業済み';
  }
  if (isWeakDueForReview(item, nowMs)) {
    return '今日復習';
  }
  const remainingMs = (item.nextReviewAtMs ?? nowMs) - nowMs;
  const days = Math.max(1, Math.ceil(remainingMs / DAY_MS));
  return `あと${days}日`;
}
