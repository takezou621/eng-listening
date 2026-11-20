import { StyleSheet, View } from 'react-native';

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

function formatMinutes(seconds: number): string {
  const m = Math.round(seconds / 60);
  return `${m} 分`;
}

/** 学習進捗画面 (Issue #13) */
export default function ProgressScreen() {
  const { colors } = useTheme();
  const days = useProgressData();

  const streak = computeStreak(days);
  const totalSeconds = computeTotalSeconds(days);
  const weekSeconds = computeWeekSeconds(days);
  const completedCount = computeCompletedLessonCount(days);
  const shadowingTotal = computeShadowingTotal(days);
  const heatmap = buildHeatmap(days, new Date(), 12);
  const hasData = totalSeconds > 0 || shadowingTotal > 0;

  // ヒートマップの色段 (0 / 〜15分 / 〜30分 / 30分超)
  const heatColor = (seconds: number): string => {
    if (seconds <= 0) return colors.secondarySurface;
    if (seconds < 15 * 60) return '#93C5FD';
    if (seconds < 30 * 60) return '#3B82F6';
    return '#1D4ED8';
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
        学習カレンダー (直近 12 週間)
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
          {['#93C5FD', '#3B82F6', '#1D4ED8'].map((c) => (
            <View key={c} style={[styles.heatCell, styles.heatLegendCell, { backgroundColor: c }]} />
          ))}
          <ThemedText variant="caption" color="muted">
            多 (1 日の学習時間)
          </ThemedText>
        </View>
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
  heatmap: { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  heatCell: { width: 16, height: 16, borderRadius: 3 },
  heatLegend: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 },
  heatLegendCell: { width: 12, height: 12 },
});
