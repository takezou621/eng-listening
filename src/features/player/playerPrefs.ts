import type { PlaybackRate } from '@/config/appConfig';

/**
 * プレイヤー表示のアプリ内設定。
 * モジュール変数なのでレッスンを離れても保持され、アプリ再起動でリセットされる。
 * GM 決定: チャンク表示時の直訳トグルの既定は OFF。
 */

export type LessonMode = 'listen' | 'read' | 'speak' | 'script';
export type ChunkDisplayMode = 'karaoke' | 'chunks';

/** 外部に見せる読み取り専用の設定値 */
export interface PlayerPrefs {
  /** 学習モード (聞く / 読む / 話す / スクリプト) */
  readonly lessonMode: LessonMode;
  /** カラオケ風表示かチャンク表示か (lessonMode のサブ互換表現) */
  readonly displayMode: ChunkDisplayMode;
  /** チャンク表示時の直訳 (文単位の自然な日本語訳) 表示。既定 OFF */
  readonly showChunkJa: boolean;
  /** 再生速度。アプリ再起動まで保持 */
  readonly rate: PlaybackRate;
  /** お手本再生後に自動でシャドーイング録音を開始するか */
  readonly autoRecordAfterModel: boolean;
}

/** 内部保持用 (可変。外部からは setter 経由でのみ変更できる) */
const prefs: {
  lessonMode: LessonMode;
  displayMode: ChunkDisplayMode;
  showChunkJa: boolean;
  rate: PlaybackRate;
  autoRecordAfterModel: boolean;
} = {
  lessonMode: 'listen',
  displayMode: 'karaoke',
  showChunkJa: false,
  rate: 1.0,
  autoRecordAfterModel: true,
};

/** 現在値の凍結コピーを返す (直接書き換えは不可。変更は必ず setter 経由で行う) */
export function getPlayerPrefs(): Readonly<PlayerPrefs> {
  return Object.freeze({ ...prefs });
}

export function setPlayerPrefsRate(rate: PlaybackRate): void {
  prefs.rate = rate;
}

export function setPlayerPrefsLessonMode(mode: LessonMode): void {
  prefs.lessonMode = mode;
  if (mode === 'listen') prefs.displayMode = 'karaoke';
  if (mode === 'read') prefs.displayMode = 'chunks';
}

export function setPlayerPrefsDisplayMode(mode: ChunkDisplayMode): void {
  prefs.displayMode = mode;
  prefs.lessonMode = mode === 'chunks' ? 'read' : 'listen';
}

/** 直訳トグルを反転して新しい値を返す */
export function togglePlayerPrefsChunkJa(): boolean {
  prefs.showChunkJa = !prefs.showChunkJa;
  return prefs.showChunkJa;
}

export function setPlayerPrefsAutoRecord(enabled: boolean): void {
  prefs.autoRecordAfterModel = enabled;
}
