import type { PlaybackRate } from '@/config/appConfig';

/**
 * プレイヤー表示のアプリ内設定。
 * モジュール変数なのでレッスンを離れても保持され、アプリ再起動でリセットされる
 * (永続化は次フェーズ)。GM 決定: チャンクごとの直訳トグルの既定は OFF。
 */

export type ChunkDisplayMode = 'karaoke' | 'chunks';

/** 外部に見せる読み取り専用の設定値 */
export interface PlayerPrefs {
  /** カラオケ (単語ハイライト) かチャンク (意味の塊) 表示か */
  readonly displayMode: ChunkDisplayMode;
  /** チャンク表示時の直訳 (文単位の自然な日本語訳) 表示。既定 OFF */
  readonly showChunkJa: boolean;
  /** 再生速度。アプリ再起動まで保持 */
  readonly rate: PlaybackRate;
}

/** 内部保持用 (可変。外部からは setter 経由でのみ変更できる) */
const prefs: {
  displayMode: ChunkDisplayMode;
  showChunkJa: boolean;
  rate: PlaybackRate;
} = {
  displayMode: 'karaoke',
  showChunkJa: false,
  rate: 1.0,
};

/** 現在値の凍結コピーを返す (直接書き換えは不可。変更は必ず setter 経由で行う) */
export function getPlayerPrefs(): Readonly<PlayerPrefs> {
  return Object.freeze({ ...prefs });
}

export function setPlayerPrefsRate(rate: PlaybackRate): void {
  prefs.rate = rate;
}

export function setPlayerPrefsDisplayMode(mode: ChunkDisplayMode): void {
  prefs.displayMode = mode;
}

/** 直訳トグルを反転して新しい値を返す */
export function togglePlayerPrefsChunkJa(): boolean {
  prefs.showChunkJa = !prefs.showChunkJa;
  return prefs.showChunkJa;
}
