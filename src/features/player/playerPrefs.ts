import type { PlaybackRate } from '@/config/appConfig';

/**
 * プレイヤー表示のアプリ内設定。
 * モジュール変数なのでレッスンを離れても保持され、アプリ再起動でリセットされる
 * (永続化は次フェーズ)。GM 決定: チャンクごとの直訳トグルの既定は OFF。
 */

export type ChunkDisplayMode = 'karaoke' | 'chunks';

interface PlayerPrefs {
  /** カラオケ (単語ハイライト) かチャンク (意味の塊) 表示か */
  displayMode: ChunkDisplayMode;
  /** チャンク表示時の直訳 (文単位の自然な日本語訳) 表示。既定 OFF */
  showChunkJa: boolean;
  /** 再生速度。アプリ再起動まで保持 */
  rate: PlaybackRate;
}

const prefs: PlayerPrefs = {
  displayMode: 'karaoke',
  showChunkJa: false,
  rate: 1.0,
};

export function getPlayerPrefs(): PlayerPrefs {
  return prefs;
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
