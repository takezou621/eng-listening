import { File, Paths } from 'expo-file-system';

import {
  flushProgressData,
  mergeExternalStudyRecords,
} from '@/features/progress/progressStore';
import type { WatchSessionRecord } from '../../../modules/watch-bridge/src/index';

/**
 * Watch 単体学習セッションの取り込み (重複排除つき)。
 *
 * Watch からは同じセッションが複数回届き得る (転送キュー + 起動時の再送) ため、
 * 適用済みセッションIDを端末内に保持し、未適用分だけを progressStore へ合算する。
 */

const STORAGE_FILE = new File(Paths.document, 'watch-sync-data.json');
const MAX_APPLIED_IDS = 1000;

let appliedIds: string[] | null = null;
let chain: Promise<void> = Promise.resolve();

async function loadAppliedIds(): Promise<string[]> {
  try {
    if (!STORAGE_FILE.exists) return [];
    const parsed: unknown = JSON.parse(await STORAGE_FILE.text());
    if (typeof parsed !== 'object' || parsed === null) return [];
    const ids = (parsed as { appliedIds?: unknown }).appliedIds;
    return Array.isArray(ids)
      ? ids.filter((id): id is string => typeof id === 'string')
      : [];
  } catch {
    return [];
  }
}

async function saveAppliedIds(ids: string[]): Promise<void> {
  try {
    await STORAGE_FILE.write(JSON.stringify({ appliedIds: ids }));
  } catch (e) {
    console.error('Failed to save watch sync data:', e);
  }
}

/** 適用済みセッションID (Watch への ack 用)。読み込み前は空配列。 */
export function getAppliedSessionIds(): string[] {
  return appliedIds ?? [];
}

/** 届いたセッションのうち未適用分だけを進捗へ合算する。呼び出しは直列化される。 */
export function applyWatchSessions(sessions: WatchSessionRecord[]): Promise<void> {
  if (!Array.isArray(sessions) || sessions.length === 0) return Promise.resolve();
  chain = chain
    .then(async () => {
      if (appliedIds === null) {
        appliedIds = await loadAppliedIds();
      }
      const seen = new Set(appliedIds);
      const fresh = sessions.filter((s) => {
        if (
          s === null ||
          typeof s !== 'object' ||
          typeof s.id !== 'string' ||
          s.id.length === 0 ||
          seen.has(s.id)
        ) {
          return false;
        }
        // 同一バッチ内の重複もここで落とす (同じセッションが複数経路で届くため)。
        seen.add(s.id);
        return true;
      });
      if (fresh.length === 0) return;
      mergeExternalStudyRecords(
        fresh.map((s) => ({
          date: s.date,
          lessonId: s.lessonId,
          seconds: s.seconds,
          completed: s.completed === true,
        })),
      );
      // 進捗の書き込みが実際に試行されてから適用済みIDを保存する
      // (ack はこの保存の後に返るため、未保存の進捗だけが消える事態を避ける)。
      await flushProgressData();
      appliedIds = [...appliedIds, ...fresh.map((s) => s.id)].slice(-MAX_APPLIED_IDS);
      await saveAppliedIds(appliedIds);
    })
    .catch(() => undefined);
  return chain;
}
