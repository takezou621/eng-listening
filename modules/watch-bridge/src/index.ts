import { EventEmitter, requireNativeModule } from 'expo-modules-core';

/**
 * Apple Watch コンパニオンとの橋渡し (ローカル Expo モジュール `WatchBridge`)。
 *
 * ネイティブモジュールが存在しない環境 (Android / Web / モジュール未リンクの
 * ビルド) では全 API が安全な no-op になる。Watch 対応は iPhone アプリの
 * 付加機能であり、本体の動作を妨げてはならない。
 */

export type WatchCommandType =
  | 'togglePlay'
  | 'nextSentence'
  | 'prevSentence'
  | 'cycleRate';

export interface WatchCommand {
  type: WatchCommandType;
  /** 将来の拡張用 (現行の Watch アプリは送らない) */
  rate?: number;
}

export interface WatchConnectionState {
  supported: boolean;
  activated: boolean;
  paired: boolean;
  watchAppInstalled: boolean;
  reachable: boolean;
}

interface WatchBridgeNative {
  updateContext(state: Record<string, unknown>): boolean;
  getConnectionState(): WatchConnectionState;
  getPendingStudySessions(): WatchSessionRecord[];
}

let native: WatchBridgeNative | null = null;
try {
  native = requireNativeModule<WatchBridgeNative>('WatchBridge');
} catch {
  native = null;
}

interface WatchEventEmitter {
  addListener(
    eventName: 'onWatchCommand',
    listener: (command: WatchCommand) => void,
  ): { remove: () => void };
  addListener(
    eventName: 'onWatchSessions',
    listener: (payload: { sessions: WatchSessionRecord[] }) => void,
  ): { remove: () => void };
}

const emitter: WatchEventEmitter | null = native
  ? (new EventEmitter(native as never) as unknown as WatchEventEmitter)
  : null;

export function isWatchBridgeAvailable(): boolean {
  return native !== null;
}

/** 最新のアプリ状態を Watch に送る (applicationContext を置き換える)。 */
export function updateWatchContext(state: Record<string, unknown>): boolean {
  if (!native) return false;
  try {
    return native.updateContext(state);
  } catch {
    return false;
  }
}

/** Watch 単体学習のセッション記録 (Watch → iPhone の同期戻し)。 */
export interface WatchSessionRecord {
  id: string;
  /** Watch 側のローカル日 (yyyy-MM-dd) */
  date: string;
  lessonId: string;
  seconds: number;
  completed: boolean;
}

/** 購読開始前に届いていた学習セッションを回収する (なければ空配列)。 */
export function getPendingWatchSessions(): WatchSessionRecord[] {
  if (!native) return [];
  try {
    return native.getPendingStudySessions() ?? [];
  } catch {
    return [];
  }
}

/** Watch から届く学習セッションを購読する。戻り値の remove() で解除する。 */
export function addWatchSessionsListener(
  listener: (sessions: WatchSessionRecord[]) => void,
): { remove: () => void } {
  if (!emitter) return { remove: () => undefined };
  return emitter.addListener('onWatchSessions', (payload) => {
    listener(Array.isArray(payload?.sessions) ? payload.sessions : []);
  });
}

export function getWatchConnectionState(): WatchConnectionState | null {
  if (!native) return null;
  try {
    return native.getConnectionState();
  } catch {
    return null;
  }
}

/** Watch からの操作コマンドを購読する。戻り値の remove() で解除する。 */
export function addWatchCommandListener(
  listener: (command: WatchCommand) => void,
): { remove: () => void } {
  if (!emitter) return { remove: () => undefined };
  return emitter.addListener('onWatchCommand', listener);
}
