import { useEffect } from 'react';

import {
  addWatchSessionsListener,
  getPendingWatchSessions,
} from '../../../modules/watch-bridge/src/index';
import { pushWatchState } from './watchSync';
import { applyWatchSessions } from './watchSyncStore';

/**
 * Watch 単体学習セッションの受け口 (ルート常駐)。
 * 起動時にネイティブ側バッファを回収し、以後は到着イベントで取り込む。
 * 実際の合算と重複排除は watchSyncStore が行う。
 */
export function WatchSessionSync(): null {
  useEffect(() => {
    // 適用できたら Watch へ ack (適用済みID) を返すため、状態を再送する。
    void applyWatchSessions(getPendingWatchSessions()).then(() => pushWatchState());
    const subscription = addWatchSessionsListener((sessions) => {
      void applyWatchSessions(sessions).then(() => pushWatchState());
    });
    return () => subscription.remove();
  }, []);
  return null;
}

export default WatchSessionSync;
