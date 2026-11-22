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

/** 連続学習日数。当日未学習でも前日まで継続していればカウントを維持する */
export function computeStreak(days: ProgressData, today: Date = new Date()): number {
  let streak = 0;
  const cursor = new Date(today);
  // 当日が未学習でも「今日やる分」として 1 日分の猶予があるため、
  // 今日の記録がなければ前日から遡る
  if (!(days[localDateStr(cursor)]?.seconds > 0)) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (days[localDateStr(cursor)]?.seconds > 0) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
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
  const todayMinutes =
    todaySeconds > 0 && todaySeconds < 60 ? 1 : Math.round(todaySeconds / 60);
  const remainingMinutes = achieved
    ? 0
    : Math.max(1, Math.ceil((targetSeconds - todaySeconds) / 60));
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

/** ヒートマップ用: start から end までの日ごとの秒数 (欠損日は 0) */
export function buildHeatmap(
  days: ProgressData,
  endDate: Date,
  weeks: number
): { date: string; seconds: number }[] {
  const out: { date: string; seconds: number }[] = [];
  const end = new Date(endDate);
  const total = weeks * 7;
  const start = new Date(end);
  start.setDate(start.getDate() - (total - 1));
  for (let i = 0; i < total; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = localDateStr(d);
    out.push({ date: key, seconds: days[key]?.seconds ?? 0 });
  }
  return out;
}
