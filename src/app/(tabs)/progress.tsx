import { AppState, Pressable, StyleSheet, View } from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';

import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import {
  buildHeatmap,
  computeCompletedLessonCount,
  computeShadowingTotal,
  computeStreak,
  computeTotalSeconds,
  computeWeekSeconds,
  useProgressData,
} from '@/features/progress/progressStore';
import { useTheme } from '@/theme/AppThemeProvider';
import { useEntitlement } from '@/features/billing/billingStore';
import { useUserData } from '@/features/library/userStore';
import { getLessonList } from '@/features/lesson/registry';

const HEAT_MINUTES = [0, 15, 30];

function formatMinutes(seconds: number): string {
  const m = Math.round(seconds / 60);
  return `${m} 分`;
}

/** 学習進捗画面 (Issue #13) */
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}-${`${d.getDate()}`.padStart(2, '0')}`;
}

export default function ProgressScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const days = useProgressData();
  const { isPremium } = useEntitlement();
  const { weakSentences } = useUserData();
  const lessonList = getLessonList();

  // 苦手フレーズの音の変化タイプ別集計 (プレミアムの詳細分析)
  const weakByType = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const w of weakSentences) {
      const bundle = lessonList.find((l) => l.entry.id === w.lessonId)?.bundle;
      const sentence = bundle?.data.sentences[w.sentenceIndex];
      for (const note of sentence?.linking ?? []) {
        const t = note.type;
        counts[t] = (counts[t] ?? 0) + 1;
      }
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [weakSentences, lessonList]) as [string, number][];
  // ローカル日を状態として保持し、AppState 復帰時に更新する
  // (進捗画面を開いたまま日付をまたいでも表示が正しく更新されるように)
  const [today, setToday] = useState(todayStr());
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setToday(todayStr());
      }
    });
    // 前景のまま日付を跨ぐケースにも対応する (60 秒間隔で再評価)
    const interval = setInterval(() => {
      setToday(todayStr());
    }, 60_000);
    return () => {
      sub.remove();
      clearInterval(interval);
    };
  }, []);

  const streak = computeStreak(days, new Date(today + 'T12:00:00'));
  const totalSeconds = computeTotalSeconds(days);
  const weekSeconds = computeWeekSeconds(days, new Date(today + 'T12:00:00'));
  const completedCount = computeCompletedLessonCount(days);
  const shadowingTotal = computeShadowingTotal(days);
  const heatmap = buildHeatmap(days, new Date(today + 'T12:00:00'), 12);
  const hasData = totalSeconds > 0 || shadowingTotal > 0 || completedCount > 0;

  // ヒートマップの色段 (0 / 〜15分 / 〜30分 / 30分超)。濃淡はテーマ側で定義
  const heatColor = (seconds: number): string => {
    const [lv0, lv1, lv2, lv3] = colors.heatLevels;
    if (seconds <= 0) return lv0;
    if (seconds < HEAT_MINUTES[1] * 60) return lv1;
    if (seconds < HEAT_MINUTES[2] * 60) return lv2;
    return lv3;
  };

  return (
    <Screen>
      <ThemedText variant="title">学習進捗</ThemedText>
      <ThemedText variant="caption" color="muted" style={styles.subtitle}>
        端末内にのみ記録を保存しています
      </ThemedText>

      {!hasData ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ThemedText variant="heading">まだ記録がありません</ThemedText>
          <ThemedText variant="caption" color="muted" style={styles.gap}>
            ライブラリからレッスンを再生すると、学習時間やシャドーイングの記録がここに表示されます。
          </ThemedText>
          <Pressable
            onPress={() => router.push('/(tabs)')}
            style={[styles.emptyLink, { backgroundColor: colors.secondarySurface }]}
          >
            <ThemedText variant="caption" color="primary" style={{ fontWeight: '600' }}>
              ライブラリを開く
            </ThemedText>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ThemedText variant="caption" color="muted">
            連続学習日数
          </ThemedText>
          <ThemedText variant="title" color="primary">
            {streak} <ThemedText variant="caption" color="muted">日</ThemedText>
          </ThemedText>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ThemedText variant="caption" color="muted">
            今週の学習
          </ThemedText>
          <ThemedText variant="heading">{formatMinutes(weekSeconds)}</ThemedText>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ThemedText variant="caption" color="muted">
            累計の学習
          </ThemedText>
          <ThemedText variant="heading">{formatMinutes(totalSeconds)}</ThemedText>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ThemedText variant="caption" color="muted">
            完了レッスン
          </ThemedText>
          <ThemedText variant="heading">{completedCount} 本</ThemedText>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ThemedText variant="caption" color="muted">
            シャドーイング
          </ThemedText>
          <ThemedText variant="heading">{shadowingTotal} 回</ThemedText>
        </View>
      </View>

      <ThemedText variant="heading" style={styles.sectionTitle}>
        学習カレンダー (直近 84 日)
      </ThemedText>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.heatmap}>
          {heatmap.map(({ date, seconds }) => (
            <View
              key={date}
              style={[styles.heatCell, { backgroundColor: heatColor(seconds) }]}
            />
          ))}
        </View>
        <View style={styles.heatLegend}>
          <ThemedText variant="caption" color="muted">
            少
          </ThemedText>
          {colors.heatLevels.slice(1).map((c) => (
            <View key={c} style={[styles.heatCell, styles.heatLegendCell, { backgroundColor: c }]} />
          ))}
          <ThemedText variant="caption" color="muted">
            多 (1 日の学習時間)
          </ThemedText>
        </View>
      </View>

      {/* プレミアムゲート (Issue #19): 詳細な弱点分析。既存機能は無料のまま */}
      <ThemedText variant="heading" style={styles.sectionTitle}>
        詳細な弱点分析 (プレミアム)
      </ThemedText>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {isPremium ? (
          <>
            <ThemedText variant="heading">苦手フレーズの音の変化 内訳</ThemedText>
            {weakByType.length > 0 ? (
              weakByType.map(([type, count]) => (
                <View key={type} style={styles.missedRow}>
                  <ThemedText variant="caption">{type}</ThemedText>
                  <ThemedText variant="caption" color="muted">
                    {count} 件
                  </ThemedText>
                </View>
              ))
            ) : (
              <ThemedText variant="caption" color="muted">
                苦手フレーズを登録すると、音の変化のタイプ別に集計して表示されます。
              </ThemedText>
            )}
            <ThemedText variant="caption" color="muted" style={styles.gap}>
              苦手フレーズ帳 (合計 {weakSentences.length} 件) と学習履歴に基づく分析です。
            </ThemedText>
          </>
        ) : (
          <>
            <ThemedText variant="caption" color="muted">
              プレミアムでは、苦手フレーズと学習履歴に基づいた詳細な種類別分析が利用できます。
            </ThemedText>
            <Pressable
              onPress={() => router.push('/paywall?from=progress')}
              style={[styles.premiumLink, { backgroundColor: colors.primary }]}
            >
              <ThemedText variant="caption" style={{ color: colors.primaryText, fontWeight: '700' }}>
                プレミアムについて見る
              </ThemedText>
            </Pressable>
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: { marginTop: 4, marginBottom: 12 },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  gap: { marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  statCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 4,
  },
  sectionTitle: { marginTop: 20, marginBottom: 8 },
  emptyLink: { borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginTop: 8 },
  premiumLink: { borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginTop: 8 },
  missedRow: { flexDirection: 'row', justifyContent: 'space-between' },
  heatmap: { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  heatCell: { width: 16, height: 16, borderRadius: 3 },
  heatLegend: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 },
  heatLegendCell: { width: 12, height: 12 },
});
