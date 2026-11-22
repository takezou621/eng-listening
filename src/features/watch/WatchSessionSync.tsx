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
    // 先に購読してからバッファを回収する (間の到着を取り逃がさないため。
    // 二重に届いても watchSyncStore が ID で重複排除する)。
    const subscription = addWatchSessionsListener((sessions) => {
      void applyWatchSessions(sessions).then(() => pushWatchState());
    });
    void applyWatchSessions(getPendingWatchSessions()).then(() => pushWatchState());
    return () => subscription.remove();
  }, []);
  return null;
}

export default WatchSessionSync;
