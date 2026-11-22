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
