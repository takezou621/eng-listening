import {
  getAppliedWatchSessionIds,
  mergeWatchStudySessions,
} from '@/features/progress/progressStore';
import type { WatchSessionRecord } from '../../../modules/watch-bridge/src/index';

/**
 * Watch 単体学習セッションの取り込み口。
 *
 * 重複排除と永続化は progressStore が担う (適用済みIDは進捗と同じ
 * ファイルに同じ書き込みで保存される)。ここは到着したセッションを
 * 直列化して渡すだけの薄い層。
 */

let chain: Promise<void> = Promise.resolve();

/** 適用済みセッションID (Watch への ack 用)。 */
export function getAppliedSessionIds(): string[] {
  return getAppliedWatchSessionIds();
}

/** 届いたセッションを進捗へ取り込む。呼び出しは直列化される。 */
export function applyWatchSessions(sessions: WatchSessionRecord[]): Promise<void> {
  if (!Array.isArray(sessions) || sessions.length === 0) return Promise.resolve();
  chain = chain
    .then(() => {
      mergeWatchStudySessions(sessions);
    })
    .catch(() => undefined);
  return chain;
}
