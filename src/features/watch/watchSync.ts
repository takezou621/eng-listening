import {
  addWatchCommandListener,
  updateWatchContext,
  type WatchCommand,
} from '../../../modules/watch-bridge/src/index';
import { getAppliedSessionIds } from './watchSyncStore';

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
let playbackToken: object | null = null;

function pushMerged(): void {
  const state: Record<string, unknown> = { updatedAtMs: Date.now() };
  if (playback) state.playback = playback;
  if (library) state.library = library;
  // Watch 単体学習セッションの適用済みID (Watch は受け取った分を未適用一覧から除く)。
  state.appliedSessionIds = getAppliedSessionIds();
  updateWatchContext(state);
}

/** 現在の状態をそのまま再送する (セッション適用後の ack 送出などに使う)。 */
export function pushWatchState(): void {
  pushMerged();
}

/** レッスン画面が再生状態を送る。null は「レッスンを開いていない」。
 *  token は画面インスタンスの所有者確認用: 画面遷移で新旧のレッスン画面が
 *  一時的に共存するとき、古い画面のクリーンアップ (null) が新しい画面の
 *  再生状態を消さないようにする。 */
/** 再生状態の所有権を画面マウント時に取得する。所有権は push より先に
 *  宣言する (登録 effect は push effect より先に走る)。 */
export function claimWatchPlayback(token: object): void {
  playbackToken = token;
}

export function pushWatchPlayback(next: WatchPlaybackState | null, token?: object): void {
  // 所有者以外からの push は受け付けない (遷移中に古い画面の effect が
  // 再生状態を送っても、所有権と表示が新しい画面から離れないように)。
  if (token !== undefined && playbackToken !== null && playbackToken !== token) return;
  if (next === null) {
    playback = null;
    playbackToken = null;
  } else {
    playback = next;
    if (token !== undefined) playbackToken = token;
  }
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
export function registerWatchCommandHandler(next: WatchCommandHandler): () => void {
  handler = next;
  if (!subscribed) {
    subscribed = true;
    addWatchCommandListener((command) => {
      handler?.(command);
    });
  }
  return () => {
    if (handler === next) handler = null;
  };
}
