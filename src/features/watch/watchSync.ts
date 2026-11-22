import {
  addWatchCommandListener,
  updateWatchContext,
  type WatchCommand,
} from '../../../modules/watch-bridge/src/index';

/**
 * Apple Watch へ送るアプリ状態の管理 (Phase 1)。
 *
 * WatchConnectivity の applicationContext は「最新の状態一式」で置き換わるため、
 * 再生状態 (レッスン画面が所有) とライブラリ状態 (進捗・苦手フレーズ) を
 * ここでマージしてから送る。どちらか一方の更新でも全体が送られる。
 */

export interface WatchPlaybackState {
  lessonTitle: string;
  sentenceIndex: number;
  sentenceCount: number;
  textEn: string;
  textJa: string;
  isPlaying: boolean;
  rate: number;
}

export interface WatchPhraseItem {
  textEn: string;
  textJa: string;
}

export interface WatchLibraryState {
  todaySeconds: number;
  streakDays: number;
  todayCompletedCount: number;
  phrases: WatchPhraseItem[];
}

let playback: WatchPlaybackState | null = null;
let library: WatchLibraryState | null = null;

function pushMerged(): void {
  const state: Record<string, unknown> = { updatedAtMs: Date.now() };
  if (playback) state.playback = playback;
  if (library) state.library = library;
  updateWatchContext(state);
}

/** レッスン画面が再生状態を送る。null は「レッスンを開いていない」。 */
export function pushWatchPlayback(next: WatchPlaybackState | null): void {
  playback = next;
  pushMerged();
}

/** 進捗・苦手フレーズの状態を送る (アプリ全体で共有する WatchLibrarySync が使う)。 */
export function pushWatchLibrary(next: WatchLibraryState): void {
  library = next;
  pushMerged();
}

export type WatchCommandHandler = (command: WatchCommand) => void;

let handler: WatchCommandHandler | null = null;
let subscribed = false;

/**
 * Watch からの操作コマンドの受け手を登録する (レッスン画面のマウント中だけ有効)。
 * ネイティブ側の購読は一度だけ張り、受け手の差し替えはここで吸収する。
 */
export function registerWatchCommandHandler(next: WatchCommandHandler | null): void {
  handler = next;
  if (next && !subscribed) {
    subscribed = true;
    addWatchCommandListener((command) => {
      handler?.(command);
    });
  }
}
