import configJson from './appConfig.json';

/**
 * アプリ全体の定数を 1 箇所に集約する。
 *
 * 識別子などの値は src/config/appConfig.json に置く。
 * Expo の設定 (app.config.ts) は CJS トランスパイル後に読まれるため TS import を使えないが、
 * 同じ JSON を require することで「値の単一ソース」を保てる。
 * 変更するときはこの JSON だけ編集すれば app.config.ts / 画面表示のすべてに反映される。
 */
export const APP_CONFIG: {
  appName: string;
  slug: string;
  scheme: string;
  version: string;
  iosBundleIdentifier: string;
  androidPackageName: string;
} = configJson;

/**
 * 学習コンテンツは「単一速度トラック + アプリ内速度変更」で難易度対応する (GM 決定)。
 * この配列が速度変更 UI とロジックの唯一の情報源。
 */
export const PLAYBACK_RATES = [0.7, 0.85, 1.0, 1.2] as const;

export type PlaybackRate = (typeof PLAYBACK_RATES)[number];

/** ピッチ補正の品質 (速度変更時に声の高さを保つ) */
export const PITCH_CORRECTION_QUALITY = 'high' as const;

/** 文単位シークの許容誤差 (ミリ秒)。開始位置に正確に乗せるため小さい値を指定 */
export const SEEK_TOLERANCE_MILLIS = 1;

/** 再生位置表示の更新間隔 (ミリ秒) */
export const STATUS_UPDATE_INTERVAL_MILLIS = 100;
