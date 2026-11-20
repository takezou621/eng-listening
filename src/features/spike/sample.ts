import type { Sentence } from '@/data/types';

/**
 * スパイク用サンプル音声のメタデータ。
 * 実音声: assets/audio/spike-sample.m4a (macOS say + ffmpeg で生成した 3 文の音読、14.24 秒)
 * タイムスタンプは ffmpeg で実測した各区間の開始位置。
 *
 * 本実装ではこの構造をコンテンツパイプライン (#1–#3, Whisper 強制アライメント) の
 * 出力で置き換える。単一速度トラック + アプリ内速度変更で難易度対応する (GM 決定)。
 */
export const SPIKE_SAMPLE: {
  asset: number;
  title: string;
  artist: string;
  durationSec: number;
  sentences: Sentence[];
} = {
  asset: require('@/assets/audio/spike-sample.m4a'),
  title: 'Booking a Table (Spike Sample)',
  artist: 'EngListening Dev',
  durationSec: 14.24,
  sentences: [
    {
      index: 0,
      startSec: 0.0,
      endSec: 4.64,
      text: 'Can you help me book a table for two tonight? I’d like something around seven thirty.',
      translationJa: '今夜2人分の席を予約したいんですが、7時半ごろでお願いできますか。',
    },
    {
      index: 1,
      startSec: 5.14,
      endSec: 10.73,
      text: 'Sure, what name should I put the reservation under? We have a window seat available if you prefer.',
      translationJa: 'かしこまりました。ご予約名はいかがしましょう。ご希望なら窓際の席もご用意できます。',
    },
    {
      index: 2,
      startSec: 11.23,
      endSec: 14.24,
      text: 'That sounds great. Thank you so much for your help.',
      translationJa: 'それは助かります。本当にありがとうございます。',
    },
  ],
};
