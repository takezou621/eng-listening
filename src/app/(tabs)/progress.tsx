import { useEffect, useMemo, useState } from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { useEntitlement } from '@/features/billing/billingStore';
import { LINKING_LABELS } from '@/features/lesson/linkingViz';
import { getLessonList, getTodaysLesson } from '@/features/lesson/registry';
import { useUserData } from '@/features/library/userStore';
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

const HEAT_MINUTES = [0, 15, 30];

function formatMinutes(seconds: number): string {
  const m = Math.round(seconds / 60);
  return `${m} 分`;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}-${`${d.getDate()}`.padStart(2, '0')}`;
}

/** 学習進捗画面 (§3 チェックリスト準拠のポリッシュ済み構成) */
export default function ProgressScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const days = useProgressData();
  const { isPremium } = useEntitlement();
  const { weakSentences } = useUserData();
  const lessonList = getLessonList();

  const weakByType = useMemo(() => {
    if (!isPremium) return [] as [string, number][];
    const counts: Record<string, number> = {};
    for (const w of weakSentences) {
      const bundle = lessonList.find((l) => l.entry.id === w.lessonId)?.bundle;
      const sentence = bundle?.data.sentences.find((st) => st.index === w.sentenceIndex);
      for (const note of sentence?.linking ?? []) {
        const t = note.type;
        counts[t] = (counts[t] ?? 0) + 1;
      }
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [weakSentences, lessonList, isPremium]) as [string, number][];

  const [today, setToday] = useState(todayStr());
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setToday(todayStr());
      }
    });
    const interval = setInterval(() => {
      setToday(todayStr());
    }, 60_000);
    return () => {
      sub.remove();
      clearInterval(interval);
    };
  }, []);

  const refDate = new Date(today + 'T12:00:00');
  const streak = computeStreak(days, refDate);
  const totalSeconds = computeTotalSeconds(days);
  const weekSeconds = computeWeekSeconds(days, refDate);
  const completedCount = computeCompletedLessonCount(days);
  const shadowingTotal = computeShadowingTotal(days);
  const heatmap = buildHeatmap(days, refDate, 12);
  const hasData = totalSeconds > 0 || shadowingTotal > 0 || completedCount > 0;
  const [selectedDay, setSelectedDay] = useState<{ date: string; seconds: number } | null>(null);

  const todaysLesson = useMemo(() => {
    const set = new Set<string>();
    for (const day of Object.values(days)) {
      for (const id of day.completedLessons ?? []) set.add(id);
    }
    return getTodaysLesson(set);
  }, [days]);

  const formatDayLabel = (date: string): string => {
    const parts = date.split('-').map(Number);
    return parts.length === 3 ? `${parts[1]}月${parts[2]}日` : date;
  };

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

      {/* ブロック 1: 連続学習ヒーローカード */}
      <View
        style={[
          styles.card,
          styles.firstCard,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <ThemedText variant="caption" color="muted">
          連続学習日数
        </ThemedText>
        <ThemedText variant="title" color="primary">
          {streak} <ThemedText variant="caption" color="muted">日</ThemedText>
        </ThemedText>
      </View>

      {/* ブロック 2: 学習サマリ (1カード 2x2) */}
      {hasData ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryCell}>
              <ThemedText variant="caption" color="muted">
                今週の学習
              </ThemedText>
              <ThemedText variant="heading">{formatMinutes(weekSeconds)}</ThemedText>
            </View>
            <View style={styles.summaryCell}>
              <ThemedText variant="caption" color="muted">
                累計の学習
              </ThemedText>
              <ThemedText variant="heading">{formatMinutes(totalSeconds)}</ThemedText>
            </View>
            <View style={styles.summaryCell}>
              <ThemedText variant="caption" color="muted">
                完了レッスン
              </ThemedText>
              <ThemedText variant="heading">{completedCount} 本</ThemedText>
            </View>
            <View style={styles.summaryCell}>
              <ThemedText variant="caption" color="muted">
                シャドーイング
              </ThemedText>
              <ThemedText variant="heading">{shadowingTotal} 回</ThemedText>
            </View>
          </View>
        </View>
      ) : (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ThemedText variant="heading">まだ記録がありません</ThemedText>
          <ThemedText variant="caption" color="muted">
            レッスンを再生すると、学習時間やシャドーイングの記録がここに表示されます。
          </ThemedText>
          <Pressable
            onPress={() => router.push('/(tabs)')}
            style={[styles.primaryCta, { backgroundColor: colors.primary }]}
          >
            <ThemedText style={{ color: colors.primaryText, fontWeight: '700' }}>
              ライブラリを開く
            </ThemedText>
          </Pressable>
        </View>
      )}

      {/* ブロック 3: 唯一のプライマリ CTA */}
      {hasData && todaysLesson ? (
        <Pressable
          onPress={() => router.push(`/lesson?lesson=${todaysLesson.item.entry.id}`)}
          style={[styles.todayCta, { backgroundColor: colors.primary }]}
        >
          <ThemedText style={{ color: colors.primaryText, fontWeight: '700' }}>
            ▶ {todaysLesson.isReview ? '復習をはじめる' : '今日の1本をはじめる'}
          </ThemedText>
          <ThemedText variant="caption" style={{ color: colors.primaryText }}>
            {todaysLesson.item.bundle?.data.titleJa ?? todaysLesson.item.entry.title}
          </ThemedText>
        </Pressable>
      ) : null}

      {/* ブロック 4: 学習カレンダー (カード内見出し) */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <ThemedText variant="heading">学習カレンダー (直近 84 日)</ThemedText>
        <View style={styles.heatmap}>
          {heatmap.map(({ date, seconds }) => (
            <Pressable
              key={date}
              onPress={() => setSelectedDay({ date, seconds })}
              style={[
                styles.heatCell,
                { backgroundColor: heatColor(seconds) },
                selectedDay?.date === date
                  ? { borderWidth: 2, borderColor: colors.primary }
                  : null,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${formatDayLabel(date)}の学習記録`}
            />
          ))}
        </View>
        <ThemedText variant="caption" color="muted">
          {selectedDay
            ? `${formatDayLabel(selectedDay.date)}: ${
                selectedDay.seconds > 0 ? formatMinutes(selectedDay.seconds) : '記録なし'
              }`
            : 'セルをタップすると、その日の学習時間が見られます'}
        </ThemedText>
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

      {/* ブロック 5: 詳細な弱点分析 (セカンダリ枠線ボタンで P1 準拠) */}
      <View
        style={[
          styles.card,
          styles.lastCard,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <ThemedText variant="heading">詳細な弱点分析 (プレミアム)</ThemedText>
        {isPremium ? (
          <>
            {weakByType.length > 0 ? (
              weakByType.map(([type, count]) => (
                <View key={type} style={styles.missedRow}>
                  <ThemedText variant="caption">
                    {LINKING_LABELS[type as keyof typeof LINKING_LABELS] ?? type}
                  </ThemedText>
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
            <ThemedText variant="caption" color="muted">
              苦手フレーズ帳 ({weakSentences.length} 件) に基づく分析です。
            </ThemedText>
          </>
        ) : (
          <>
            <ThemedText variant="caption" color="muted">
              プレミアムでは、苦手フレーズと学習履歴に基づいた詳細な種類別分析が利用できます。
            </ThemedText>
            <Pressable
              onPress={() => router.push('/paywall?from=progress')}
              style={[styles.secondaryOutline, { borderColor: colors.primary }]}
            >
              <ThemedText variant="caption" color="primary" style={styles.secondaryLabel}>
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
  firstCard: { marginTop: 0 },
  lastCard: { marginBottom: 24 },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 8,
    marginTop: 12,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 12,
    columnGap: 12,
  },
  summaryCell: {
    width: '46%',
    gap: 2,
  },
  primaryCta: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  todayCta: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 2,
    marginTop: 12,
  },
  secondaryOutline: {
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  secondaryLabel: {
    fontWeight: '700',
  },
  missedRow: { flexDirection: 'row', justifyContent: 'space-between' },
  heatmap: { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  heatCell: { width: 16, height: 16, borderRadius: 3 },
  heatLegend: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  heatLegendCell: { width: 12, height: 12 },
});
