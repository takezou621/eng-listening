import cafeLessonJson from '@/assets/lessons/cafe-ordering/lesson.json';
import { assertValidLesson, type LessonData } from '@/features/lesson/types';

/**
 * パイプライン生成物のサンプルレッスン (カフェでの注文・初級会話)。
 *
 * 音声: assets/lessons/cafe-ordering/audio.m4a (Google Cloud TTS Neural2 + ffmpeg 連結)
 * タイムスタンプ: faster-whisper による単語レベルアライメント
 * 再生成: docs/content-pipeline.md の手順に従う
 */
export const CAFE_LESSON = cafeLessonJson as LessonData;
assertValidLesson(CAFE_LESSON);

/** レッスン JSON と同じディレクトリに同梱した音声アセット */
export const CAFE_LESSON_AUDIO = require('@/assets/lessons/cafe-ordering/audio.m4a') as number;
