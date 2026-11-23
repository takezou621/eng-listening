import airportJson from '@/assets/lessons/at-the-airport/lesson.json';
import cafeJson from '@/assets/lessons/cafe-ordering/lesson.json';
import directionsJson from '@/assets/lessons/asking-directions/lesson.json';
import hometownJson from '@/assets/lessons/introducing-my-hometown/lesson.json';
import hotelJson from '@/assets/lessons/hotel-checkin/lesson.json';
import kyotoJson from '@/assets/lessons/weekend-in-kyoto/lesson.json';
import movieJson from '@/assets/lessons/my-favorite-movie/lesson.json';
import morningJson from '@/assets/lessons/my-morning-routine/lesson.json';
import phoneJson from '@/assets/lessons/phone-appointment/lesson.json';
import restaurantJson from '@/assets/lessons/restaurant-order/lesson.json';
import shoppingJson from '@/assets/lessons/shopping-clothes/lesson.json';
import smallTalkJson from '@/assets/lessons/small-talk-coworker/lesson.json';
import { assertValidLesson, type LessonData } from '@/features/lesson/types';

/**
 * パイプライン生成レッスンの登録表 (12 本計画 v1.0)。
 *
 * - CATALOG が計画の全 12 本。BUNDLES は音声付きで同梱済みのもの。
 * - BUNDLES に無いレッスンは「準備中」表示になり、クラッシュしない
 *   (音声の生成は tools/content/ のパイプラインで行う。docs/content-pipeline.md)。
 * - Metro がアセットを静的に解決するため、require のパスはリテラルで書く。
 *   新しいレッスンを追加するときは import・BUNDLES への登録・CATALOG を更新する。
 */

export interface CatalogEntry {
  id: string;
  title: string;
  titleJa: string;
  type: 'conversation' | 'monologue';
  level: 'beginner' | 'intermediate';
}

export const LESSON_CATALOG: CatalogEntry[] = [
  { id: 'cafe-ordering', title: 'Ordering at a Café', titleJa: 'カフェで注文する', type: 'conversation', level: 'beginner' },
  { id: 'hotel-checkin', title: 'Checking In at a Hotel', titleJa: 'ホテルでチェックインする', type: 'conversation', level: 'beginner' },
  { id: 'asking-directions', title: 'Asking for Directions', titleJa: '道を聞く', type: 'conversation', level: 'beginner' },
  { id: 'shopping-clothes', title: 'Buying Clothes', titleJa: '服を買う', type: 'conversation', level: 'beginner' },
  { id: 'restaurant-order', title: 'Ordering at a Restaurant', titleJa: 'レストランで注文する', type: 'conversation', level: 'intermediate' },
  { id: 'phone-appointment', title: 'Making an Appointment by Phone', titleJa: '電話で予約を入れる', type: 'conversation', level: 'intermediate' },
  { id: 'at-the-airport', title: 'At the Airport', titleJa: '空港で', type: 'conversation', level: 'intermediate' },
  { id: 'small-talk-coworker', title: 'Small Talk with a Coworker', titleJa: '同僚との雑談', type: 'conversation', level: 'intermediate' },
  { id: 'my-morning-routine', title: 'My Morning Routine', titleJa: '朝の習慣', type: 'monologue', level: 'beginner' },
  { id: 'weekend-in-kyoto', title: 'A Weekend Trip to Kyoto', titleJa: '週末の京都旅行', type: 'monologue', level: 'intermediate' },
  { id: 'introducing-my-hometown', title: 'Introducing My Hometown', titleJa: '故郷の紹介', type: 'monologue', level: 'intermediate' },
  { id: 'my-favorite-movie', title: 'My Favorite Movie', titleJa: '好きな映画', type: 'monologue', level: 'beginner' },
];

function loadLesson(json: unknown, id: string): LessonData {
  const lesson = json as LessonData;
  assertValidLesson(lesson);
  if (lesson.id !== id) {
    throw new Error(`レッスン id 不一致:期待=${id}, 実際=${String(lesson.id)}`);
  }
  return lesson;
}

export interface LessonBundle {
  data: LessonData;
  audio: number;
}

/** 音声付きで同梱済みのレッスン (パイプライン生成済み) */
export const BUNDLES: Record<string, LessonBundle> = {
  'cafe-ordering': {
    data: loadLesson(cafeJson, 'cafe-ordering'),
    audio: require('@/assets/lessons/cafe-ordering/audio.m4a') as number,
  },
  'hotel-checkin': {
    data: loadLesson(hotelJson, 'hotel-checkin'),
    audio: require('@/assets/lessons/hotel-checkin/audio.m4a') as number,
  },
  'asking-directions': {
    data: loadLesson(directionsJson, 'asking-directions'),
    audio: require('@/assets/lessons/asking-directions/audio.m4a') as number,
  },
  'shopping-clothes': {
    data: loadLesson(shoppingJson, 'shopping-clothes'),
    audio: require('@/assets/lessons/shopping-clothes/audio.m4a') as number,
  },
  'restaurant-order': {
    data: loadLesson(restaurantJson, 'restaurant-order'),
    audio: require('@/assets/lessons/restaurant-order/audio.m4a') as number,
  },
  'phone-appointment': {
    data: loadLesson(phoneJson, 'phone-appointment'),
    audio: require('@/assets/lessons/phone-appointment/audio.m4a') as number,
  },
  'at-the-airport': {
    data: loadLesson(airportJson, 'at-the-airport'),
    audio: require('@/assets/lessons/at-the-airport/audio.m4a') as number,
  },
  'small-talk-coworker': {
    data: loadLesson(smallTalkJson, 'small-talk-coworker'),
    audio: require('@/assets/lessons/small-talk-coworker/audio.m4a') as number,
  },
  'my-morning-routine': {
    data: loadLesson(morningJson, 'my-morning-routine'),
    audio: require('@/assets/lessons/my-morning-routine/audio.m4a') as number,
  },
  'weekend-in-kyoto': {
    data: loadLesson(kyotoJson, 'weekend-in-kyoto'),
    audio: require('@/assets/lessons/weekend-in-kyoto/audio.m4a') as number,
  },
  'introducing-my-hometown': {
    data: loadLesson(hometownJson, 'introducing-my-hometown'),
    audio: require('@/assets/lessons/introducing-my-hometown/audio.m4a') as number,
  },
  'my-favorite-movie': {
    data: loadLesson(movieJson, 'my-favorite-movie'),
    audio: require('@/assets/lessons/my-favorite-movie/audio.m4a') as number,
  },
};

export const DEFAULT_LESSON_ID = 'cafe-ordering';

export interface LessonListItem {
  entry: CatalogEntry;
  /** null = 音声未生成 (準備中) */
  bundle: LessonBundle | null;
}

/** 計画 12 本の一覧。音声の有無を含めて返す */
export function getLessonList(): LessonListItem[] {
  return LESSON_CATALOG.map((entry) => ({
    entry,
    bundle: BUNDLES[entry.id] ?? null,
  }));
}

/**
 * 今日のおすすめ: 診断/カリキュラム由来の推奨レッスン (未完了のもの) を最優先し、
 * 未指定または完了済みの場合は未完了の最初のレッスン、全て完了していれば先頭を復習用に返す。
 */
export function getTodaysLesson(
  completedIds: Set<string>,
  preferredLessonId?: string | null
): { item: LessonListItem; isReview: boolean } | null {
  const bundled = getLessonList().filter((it) => it.bundle !== null);
  if (bundled.length === 0) return null;
  if (preferredLessonId && !completedIds.has(preferredLessonId)) {
    const preferred = bundled.find((it) => it.entry.id === preferredLessonId);
    if (preferred) return { item: preferred, isReview: false };
  }
  const next = bundled.find((it) => !completedIds.has(it.entry.id));
  if (next) return { item: next, isReview: false };
  return { item: bundled[0], isReview: true };
}

export function getLessonBundle(id: string | undefined): LessonBundle {
  // __proto__ など継承プロパティを返さないよう、登録表自身のプロパティだけを見る
  if (id !== undefined && Object.prototype.hasOwnProperty.call(BUNDLES, id)) {
    return BUNDLES[id];
  }
  return BUNDLES[DEFAULT_LESSON_ID];
}
