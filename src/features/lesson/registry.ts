import cafeLessonJson from '@/assets/lessons/cafe-ordering/lesson.json';
import hotelLessonJson from '@/assets/lessons/hotel-checkin/lesson.json';
import { assertValidLesson, type LessonData } from '@/features/lesson/types';

/**
 * パイプライン生成物のレッスン登録表。
 *
 * 各レッスンは assets/lessons/<id>/ (lesson.json + audio.m4a) として同梱し、
 * 生成方法は docs/content-pipeline.md を参照。
 * 新しいレッスンを追加するときは import と登録をここに足す
 * (Metro がアセットを静的に解決できるよう require のパスはリテラルで書く)。
 */

const cafeLesson = loadLesson(cafeLessonJson, 'cafe-ordering');
const hotelLesson = loadLesson(hotelLessonJson, 'hotel-checkin');

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

/** パイプラインで生成済みのレッスン */
export const LESSONS: Record<string, LessonBundle> = {
  [cafeLesson.id]: {
    data: cafeLesson,
    audio: require('@/assets/lessons/cafe-ordering/audio.m4a') as number,
  },
  [hotelLesson.id]: {
    data: hotelLesson,
    audio: require('@/assets/lessons/hotel-checkin/audio.m4a') as number,
  },
};

export const DEFAULT_LESSON_ID = cafeLesson.id;

export function getLessonBundle(id: string | undefined): LessonBundle {
  // __proto__ など継承プロパティを返さないよう、登録表自身のプロパティだけを見る
  if (id !== undefined && Object.prototype.hasOwnProperty.call(LESSONS, id)) {
    return LESSONS[id];
  }
  return LESSONS[DEFAULT_LESSON_ID];
}
