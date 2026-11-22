import { Paths, File } from 'expo-file-system';
import { useEffect, useState } from 'react';

/**
 * 学習進捗の永続化ストア (Issue #13)。
 * 端末内 (expo-file-system の Document ディレクトリ) の JSON に保存し、
 * アカウント同期は行わない (MVP スコープ)。
 *
 * 記録の単位は「日 (ローカル日)」。再生秒数は実際に再生が進行した時間のみを
 * 累計する (一時停止・シークジャンプ・逆再生はカウントしない = 水増ししない)。
 *
 * 読み込みは useProgressData のマウント時に行うが、それ以前の記録も
 * updateData がメモリに蓄積し、読み込み完了後にマージして永続化するため、
 * 進捗画面のマウントに依存せずに記録が保存される。
 */

const STORAGE_FILE = new File(Paths.document, 'progress-data.json');

/** 1 日分の学習記録 (ローカル日ベース) */
export interface DayRecord {
  /** YYYY-MM-DD (ローカルタイムゾーン) */
  date: string;
  /** その日に実際に再生が進行した秒数の合計 */
  seconds: number;
  /** その日に実施したシャドーイング (録音完了) の回数 */
  shadowingCount: number;
  /** その日に再生したレッスン id (重複なし) */
  playedLessons: string[];
  /** その日に最後まで再生したレッスン id (重複なし) */
  completedLessons: string[];
}

type ProgressData = Record<string, DayRecord>;

const defaultData: ProgressData = {};

// インメモリのキャッシュ。変更時は必ず新しい参照を作る (React の再描画検知のため)
let cachedData: ProgressData = { ...defaultData };
let isLoaded = false;
let loadPromise: Promise<void> | null = null;
let canPersist = false;
let saveQueue: Promise<void> = Promise.resolve();
const listeners = new Set<() => void>();

export function localDateStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseProgress(json: string): ProgressData {
  const parsed: unknown = JSON.parse(json);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ...defaultData };
  }
  const out: ProgressData = { ...defaultData };
  for (const [date, record] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof record !== 'object' || record === null) continue;
    const r = record as Partial<DayRecord>;
    if (typeof r.seconds !== 'number' || !Number.isFinite(r.seconds)) continue;
    out[date] = {
      date,
      seconds: Math.max(0, r.seconds),
      shadowingCount: typeof r.shadowingCount === 'number' ? r.shadowingCount : 0,
      playedLessons: Array.isArray(r.playedLessons)
        ? r.playedLessons.filter((id): id is string => typeof id === 'string')
        : [],
      completedLessons: Array.isArray(r.completedLessons)
        ? r.completedLessons.filter((id): id is string => typeof id === 'string')
        : [],
    };
  }
  return out;
}

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

/**
 * すべての書き込みはこの直列化キューを通る。
 * 読み込み完了 (canPersist = true) 前の更新はキューに保留され、
 * 読み込み成功後にまとめてフラッシュされる。
 * 読み込みが失敗した場合はゲートが開かないため、既存ファイルを保護する。
 */
function flushToDisk() {
  saveQueue = saveQueue.then(async () => {
    try {
      await STORAGE_FILE.write(JSON.stringify(cachedData));
    } catch (e) {
      console.error('Failed to save progress data:', e);
    }
  });
}

function updateData(mutate: (current: ProgressData) => ProgressData) {
  cachedData = mutate(cachedData);
  notify();
  if (canPersist) {
    flushToDisk();
  }
  // canPersist = false のときはメモリにのみ蓄積し、
  // 読み込み完了後にマージして永続化される
}

/**
 * 読み込みは 1 回だけ実行し、並走呼び出しを dedupe する。
 * 成功時: canPersist を true にして、読み込み中にメモリへ蓄積された記録を
 * 日別にマージしたうえでフラッシュする。
 * 失敗時: loadPromise を null に戻して再試行可能にする。
 * isLoaded は失敗時も true にする (毎回の自動読み込みを防ぐため)。
 */
export function loadProgressDataAsync(): Promise<void> {
  if (loadPromise) {
    return loadPromise;
  }
  loadPromise = (async () => {
    let parsed: ProgressData | null = null;
    try {
      if (STORAGE_FILE.exists) {
        parsed = parseProgress(await STORAGE_FILE.text());
      }
    } catch (e) {
      console.error('Failed to load progress data:', e);
      // 再試行可能にする: loadPromise を null に戻し、isLoaded を立てない。
      // これにより useProgressData の次回マウントで再読み込みが走る。
      // canPersist は false のまま (既存ファイルの保護)。
      loadPromise = null;
      notify();
      return;
    }
    canPersist = true;
    // 読み込み成功時は isLoaded を立てない
    // (失敗時も含めて再試行可能な状態を維持する)
    // 保存済みの全履歴 (parsed) を土台にし、メモリ内の記録 (読み込み待ち中に蓄積された分) を
    // 日別に加算マージする。parsed にしかない日付・メモリにしかない日付の両方を保持する。
    const memoryData = cachedData;
    cachedData = parsed ? { ...parsed } : { ...defaultData };
    for (const [date, memory] of Object.entries(memoryData)) {
      const saved = cachedData[date];
      if (saved) {
        cachedData[date] = {
          ...saved,
          seconds: saved.seconds + memory.seconds,
          shadowingCount: saved.shadowingCount + memory.shadowingCount,
          playedLessons: [...new Set([...saved.playedLessons, ...memory.playedLessons])],
          completedLessons: [
            ...new Set([...saved.completedLessons, ...memory.completedLessons]),
          ],
        };
      } else {
        cachedData[date] = memory;
      }
    }
    // 新しいオブジェクト参照を代入済みのため React の再描画が確実に走る
    notify();
    flushToDisk();
  })();
  return loadPromise;
}

export function useProgressData() {
  const [data, setData] = useState(cachedData);

  useEffect(() => {
    if (!isLoaded) {
      void loadProgressDataAsync();
    }
    const listener = () => setData(cachedData);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return data;
}

/** 実際に再生が進行した秒数を指定日の記録に加算する (省略時は今日) */
export function addStudySeconds(lessonId: string, seconds: number, date?: string) {
  if (seconds <= 0) return;
  const targetDate = date ?? localDateStr();
  updateData((current) => {
    const day: DayRecord = current[targetDate] ?? {
      date: targetDate,
      seconds: 0,
      shadowingCount: 0,
      playedLessons: [],
      completedLessons: [],
    };
    return {
      ...current,
      [targetDate]: {
        ...day,
        seconds: day.seconds + seconds,
        playedLessons: day.playedLessons.includes(lessonId)
          ? day.playedLessons
          : [...day.playedLessons, lessonId],
      },
    };
  });
}

/** レッスンを最後まで再生したことを記録する */
export function markLessonCompleted(lessonId: string) {
  const date = localDateStr();
  updateData((current) => {
    const day: DayRecord = current[date] ?? {
      date,
      seconds: 0,
      shadowingCount: 0,
      playedLessons: [],
      completedLessons: [],
    };
    return {
      ...current,
      [date]: {
        ...day,
        completedLessons: day.completedLessons.includes(lessonId)
          ? day.completedLessons
          : [...day.completedLessons, lessonId],
      },
    };
  });
}

/** シャドーイング (録音完了) 1 回を記録する */
export function addShadowingRecord(lessonId: string) {
  const date = localDateStr();
  updateData((current) => {
    const day: DayRecord = current[date] ?? {
      date,
      seconds: 0,
      shadowingCount: 0,
      playedLessons: [],
      completedLessons: [],
    };
    return {
      ...current,
      [date]: { ...day, shadowingCount: day.shadowingCount + 1 },
    };
  });
}

// ---------------------------------------------------------------------------
// 集計 (ローカル日ベースの純関数)
// ---------------------------------------------------------------------------

/** 日付が属する暦週 (月曜始まり) の月曜日の YYYY-MM-DD を返す */
export function isoWeekKey(date: Date): string {
  const copy = new Date(date);
  copy.setHours(12, 0, 0, 0);
  const offset = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - offset);
  return localDateStr(copy);
}

export interface StreakInfo {
  /** 連続学習日数（週1回の自動フリーズで1日抜けを橋渡しした実学習日数） */
  streak: number;
  /** 今週（月〜日）の自動フリーズ残数（0 または 1） */
  freezeRemainingThisWeek: number;
  /** 現在の連続記録内でフリーズ保護が適用された日付一覧（YYYY-MM-DD） */
  frozenDates: string[];
  /** 昨日がフリーズ保護対象になったか */
  rescuedYesterday: boolean;
}

function parseLocalDate(key: string): Date {
  const [y, m, d] = key.split('-').map((v) => Number(v));
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
}

/**
 * 学習履歴全体を暦日順 (過去→現在) に走査し、自動フリーズで保護される日付の集合を返す。
 * フリーズは「連続が生きている状態での1日だけの抜け」に対して、その日が属する
 * 暦週 (月〜日) で未使用の場合に、暦日順で最初に現れた抜けへ適用される
 * (後ろ向きに走査すると同一週の2回目の抜けを誤って保護してしまうため、
 * 必ず前向きに判定する)。
 */
export function computeFrozenDates(days: ProgressData, through: Date = new Date()): Set<string> {
  const frozen = new Set<string>();
  const studiedKeys = Object.keys(days)
    .filter((k) => (days[k]?.seconds ?? 0) > 0)
    .sort();
  if (studiedKeys.length === 0) return frozen;

  const usedWeeks = new Set<string>();
  const cursor = parseLocalDate(studiedKeys[0]);
  const end = new Date(through);
  end.setHours(12, 0, 0, 0);
  let streakAlive = false;
  let prevStudied = false;

  while (cursor.getTime() <= end.getTime()) {
    const key = localDateStr(cursor);
    if ((days[key]?.seconds ?? 0) > 0) {
      streakAlive = true;
      prevStudied = true;
    } else if (streakAlive && prevStudied) {
      const weekKey = isoWeekKey(cursor);
      if (!usedWeeks.has(weekKey)) {
        usedWeeks.add(weekKey);
        frozen.add(key);
      } else {
        streakAlive = false;
      }
      // 保護された日の直後は「学習日」扱いにしない (2日連続の抜けは保護しない)
      prevStudied = false;
    } else {
      streakAlive = false;
      prevStudied = false;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return frozen;
}

/**
 * ストリーク救済付き連続学習日数 (E16)。
 * 罰ではなく保険として、暦週（月〜日）ごとに1回まで「1日抜け」を自動フリーズで保護する。
 * 連続日数のカウント自体は実際に学習した日数のみを数える（水増ししない）。
 */
export function computeStreakWithFreeze(
  days: ProgressData,
  today: Date = new Date()
): StreakInfo {
  const frozenAll = computeFrozenDates(days, today);
  const base = new Date(today);
  base.setHours(12, 0, 0, 0);

  const todayKey = localDateStr(base);
  const yesterday = new Date(base);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = localDateStr(yesterday);

  const cursor = new Date(base);
  // 当日が未学習でも「今日やる分」の猶予があるため前日から遡る
  if (!((days[todayKey]?.seconds ?? 0) > 0)) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  const frozenDates: string[] = [];
  for (;;) {
    const key = localDateStr(cursor);
    if ((days[key]?.seconds ?? 0) > 0) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    if (frozenAll.has(key)) {
      frozenDates.push(key);
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    break;
  }

  const currentWeek = isoWeekKey(base);
  const usedThisWeek = [...frozenAll].some((k) => isoWeekKey(parseLocalDate(k)) === currentWeek);
  return {
    streak,
    freezeRemainingThisWeek: usedThisWeek ? 0 : 1,
    frozenDates,
    rescuedYesterday: frozenDates.includes(yesterdayKey),
  };
}

/** 連続学習日数。週1回の自動フリーズによる救済を含む */
export function computeStreak(days: ProgressData, today: Date = new Date()): number {
  return computeStreakWithFreeze(days, today).streak;
}

/** 累計学習秒数 */
export function computeTotalSeconds(days: ProgressData): number {
  return Object.values(days).reduce((sum, day) => sum + day.seconds, 0);
}

/** 当日の学習秒数 */
export function computeTodaySeconds(days: ProgressData, today: Date = new Date()): number {
  return days[localDateStr(today)]?.seconds ?? 0;
}

export interface DailyGoalStatus {
  todayMinutes: number;
  goalMinutes: number;
  ratio: number;
  remainingMinutes: number;
  achieved: boolean;
}

/** 1日の学習目標に対する本日の進捗を返す (ELSA / abceed 型) */
export function computeDailyGoalStatus(
  todaySeconds: number,
  goalMinutes: number
): DailyGoalStatus {
  const safeGoal = Math.max(goalMinutes, 1);
  const targetSeconds = safeGoal * 60;
  const achieved = todaySeconds >= targetSeconds;
  // 表示分数は切り捨てを基本とし、達成前に目標分数へ到達して見えないようにする。
  // 「表示 + 残り = 目標」が常に成り立つよう、残りは目標から表示を引いて求める
  const todayMinutes =
    todaySeconds <= 0 ? 0 : Math.max(1, Math.floor(todaySeconds / 60));
  const remainingMinutes = achieved ? 0 : safeGoal - Math.min(todayMinutes, safeGoal - 1);
  const ratio = Math.min(Math.max(todaySeconds / targetSeconds, 0), 1);
  return {
    todayMinutes,
    goalMinutes: safeGoal,
    ratio,
    remainingMinutes,
    achieved,
  };
}

/** 今週 (月曜開始の暦週) の学習秒数。未来日付 (翌月曜以降) は含めない */
export function computeWeekSeconds(days: ProgressData, today: Date = new Date()): number {
  const start = new Date(today);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); // 月曜に戻る
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 7); // 翌月曜 (排他上限)
  let sum = 0;
  for (const day of Object.values(days)) {
    const d = new Date(`${day.date}T00:00:00`);
    if (!Number.isNaN(d.getTime()) && d >= start && d < end) {
      sum += day.seconds;
    }
  }
  return sum;
}

/** 累計で完了したレッスン数 (ユニークなレッスン id) */
export function computeCompletedLessonCount(days: ProgressData): number {
  const set = new Set<string>();
  for (const day of Object.values(days)) {
    for (const id of day.completedLessons) {
      set.add(id);
    }
  }
  return set.size;
}

/** 累計シャドーイング回数 */
export function computeShadowingTotal(days: ProgressData): number {
  return Object.values(days).reduce((sum, day) => sum + day.shadowingCount, 0);
}

/** ヒートマップ用: start から end までの日ごとの秒数とフリーズ保護有無 */
export function buildHeatmap(
  days: ProgressData,
  endDate: Date,
  weeks: number
): { date: string; seconds: number; frozen: boolean }[] {
  const frozenSet = computeFrozenDates(days, endDate);
  const out: { date: string; seconds: number; frozen: boolean }[] = [];
  const end = new Date(endDate);
  const total = weeks * 7;
  const start = new Date(end);
  start.setDate(start.getDate() - (total - 1));
  for (let i = 0; i < total; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = localDateStr(d);
    const seconds = days[key]?.seconds ?? 0;
    out.push({ date: key, seconds, frozen: seconds <= 0 && frozenSet.has(key) });
  }
  return out;
}
