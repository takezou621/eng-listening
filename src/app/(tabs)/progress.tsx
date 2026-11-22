import { useEffect, useMemo, useState } from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { DailyGoalSheet } from '@/components/DailyGoalSheet';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { useEntitlement } from '@/features/billing/billingStore';
import {
  LINKING_LABELS,
  LINKING_TEXT_DECORATIONS,
  getLinkingColor,
} from '@/features/lesson/linkingViz';
import type { LessonLinkingNote } from '@/features/lesson/types';
import { getLessonList, getTodaysLesson } from '@/features/lesson/registry';
import { useUserData } from '@/features/library/userStore';
import {
  buildCurrentWeekStrip,
  buildWeeklyHeatmap,
  computeCompletedLessonCount,
  computeDailyGoalStatus,
  computeShadowingTotal,
  computeStreakWithFreeze,
  computeTodaySeconds,
  computeTotalSeconds,
  computeWeekSeconds,
  useProgressData,
} from '@/features/progress/progressStore';
import { useTheme } from '@/theme/AppThemeProvider';

const HEAT_MINUTES = [0, 15, 30];
const WEEKDAY_ROW_LABELS = ['月', '火', '水', '木', '金', '土', '日'] as const;

function formatMinutes(seconds: number): string {
  const m = Math.round(seconds / 60);
  return `${m} 分`;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}-${`${d.getDate()}`.padStart(2, '0')}`;
}

/** 学習進捗画面 (Issue #13 / #46: 週次カレンダー・今週ドット・目標・弱点グラフ可視化) */
export default function ProgressScreen() {
  const router = useRouter();
  const { scheme, colors } = useTheme();
  const days = useProgressData();
  const { isPremium } = useEntitlement();
  const { weakSentences, dailyGoalMinutes, setDailyGoalMinutes } = useUserData();
  const [goalSheetVisible, setGoalSheetVisible] = useState(false);
  const lessonList = getLessonList();

  const weakByType = useMemo(() => {
    if (!isPremium) return [] as [LessonLinkingNote['type'], number][];
    const counts: Partial<Record<LessonLinkingNote['type'], number>> = {};
    for (const w of weakSentences) {
      const bundle = lessonList.find((l) => l.entry.id === w.lessonId)?.bundle;
      const sentence = bundle?.data.sentences.find((st) => st.index === w.sentenceIndex);
      for (const note of sentence?.linking ?? []) {
        counts[note.type] = (counts[note.type] ?? 0) + 1;
      }
    }
    return (Object.entries(counts) as [LessonLinkingNote['type'], number][]).sort(
      (a, b) => b[1] - a[1]
    );
  }, [weakSentences, lessonList, isPremium]);

  const maxWeakCount = weakByType[0]?.[1] ?? 1;

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
  const streakInfo = computeStreakWithFreeze(days, refDate);
  const weekStrip = buildCurrentWeekStrip(days, refDate);
  const totalSeconds = computeTotalSeconds(days);
  const weekSeconds = computeWeekSeconds(days, refDate);
  const todaySeconds = computeTodaySeconds(days, refDate);
  const goalStatus = computeDailyGoalStatus(todaySeconds, dailyGoalMinutes);
  const completedCount = computeCompletedLessonCount(days);
  const shadowingTotal = computeShadowingTotal(days);
  const weeklyGrid = buildWeeklyHeatmap(days, refDate, 12);
  const hasData = totalSeconds > 0 || shadowingTotal > 0 || completedCount > 0;
  const [selectedDay, setSelectedDay] = useState<{
    date: string;
    seconds: number;
    frozen: boolean;
  } | null>(null);

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

  // WCAG AA (5.02:1) 準拠のテーマセマンティック色を使用
  const successColor = colors.success;
  const freezeBg = scheme === 'dark' ? '#0C4A6E' : '#E0F2FE';
  const freezeColor = scheme === 'dark' ? '#38BDF8' : '#0369A1';
  const freezeCellBg = scheme === 'dark' ? '#0EA5E9' : '#38BDF8';
  const freezeCellBorder = scheme === 'dark' ? '#7DD3FC' : '#0284C7';

  const heatColor = (seconds: number): string => {
    const [lv0, lv1, lv2, lv3] = colors.heatLevels;
    if (seconds <= 0) return lv0;
    if (seconds < HEAT_MINUTES[1] * 60) return lv1;
    if (seconds < HEAT_MINUTES[2] * 60) return lv2;
    return lv3;
  };

  const streakHint = streakInfo.rescuedYesterday
    ? '❄ 昨日のお休みを自動保護しました。今日も 1 本で記録を伸ばせます。'
    : streakInfo.frozenDates.length > 0
      ? '週 1 回のお休み保護により連続記録がつながっています。'
      : '週 1 回まで 1 日お休みしても連続記録を自動で守ります。';

  return (
    <Screen>
      <ThemedText variant="title">学習進捗</ThemedText>
      <ThemedText variant="caption" color="muted" style={styles.subtitle}>
        端末内にのみ記録を保存しています
      </ThemedText>

      {/* ブロック 1: 今日の目標カード (主 CTA を内包し P1 / P2 を維持) */}
      <View
        style={[
          styles.card,
          styles.firstCard,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View style={styles.goalHeader}>
          <ThemedText variant="heading">今日の目標</ThemedText>
          <Pressable
            onPress={() => setGoalSheetVisible(true)}
            hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="目標を変更"
          >
            <ThemedText variant="caption" color="primary" style={styles.changeText}>
              目標を変更
            </ThemedText>
          </Pressable>
        </View>

        <View style={styles.goalMetricRow}>
          <ThemedText variant="title" color="primary">
            {goalStatus.todayMinutes}{' '}
            <ThemedText variant="caption" color="muted">
              / {goalStatus.goalMinutes} 分
            </ThemedText>
          </ThemedText>
          <ThemedText
            variant="caption"
            style={{
              color: goalStatus.achieved ? successColor : colors.textMuted,
              fontWeight: '700',
            }}
          >
            {goalStatus.achieved ? '✓ 目標達成！' : `あと ${goalStatus.remainingMinutes} 分`}
          </ThemedText>
        </View>

        <View style={[styles.goalTrack, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.goalFill,
              {
                width: `${goalStatus.ratio * 100}%`,
                backgroundColor: goalStatus.achieved ? successColor : colors.primary,
              },
            ]}
          />
        </View>

        {hasData && todaysLesson ? (
          <Pressable
            onPress={() => router.push(`/lesson?lesson=${todaysLesson.item.entry.id}`)}
            style={[styles.todayCta, { backgroundColor: colors.primary }]}
            accessibilityRole="button"
          >
            <ThemedText style={{ color: colors.primaryText, fontWeight: '700' }}>
              ▶ {todaysLesson.isReview ? '復習をはじめる' : '今日の1本をはじめる'}
            </ThemedText>
            <ThemedText variant="caption" style={{ color: colors.primaryText }}>
              {todaysLesson.item.bundle?.data.titleJa ?? todaysLesson.item.entry.title}
            </ThemedText>
          </Pressable>
        ) : null}
      </View>

      {/* ブロック 2: ストリーク & 今週 7 日間の視覚ドット */}
      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View style={styles.streakTop}>
          <View>
            <ThemedText variant="caption" color="muted">
              連続学習日数
            </ThemedText>
            <ThemedText variant="title" color="primary">
              {streakInfo.streak} <ThemedText variant="caption" color="muted">日</ThemedText>
            </ThemedText>
          </View>
          <View style={[styles.freezePill, { backgroundColor: freezeBg }]}>
            <ThemedText variant="caption" style={{ color: freezeColor, fontWeight: '700' }}>
              {streakInfo.freezeRemainingThisWeek > 0
                ? '🛡 今週の保険 残り1回'
                : '❄ 今週の保険 使用済み'}
            </ThemedText>
          </View>
        </View>

        <View style={styles.weekStripRow}>
          {weekStrip.map((day) => {
            const studied = day.seconds > 0;
            return (
              <View
                key={day.date}
                style={styles.weekStripItem}
                accessible
                accessibilityLabel={`${day.weekdayLabel}曜日: ${
                  day.isFuture
                    ? '予定'
                    : studied
                      ? `${formatMinutes(day.seconds)}学習済み`
                      : day.frozen
                        ? 'フリーズで保護'
                        : '未学習'
                }`}
              >
                <View
                  style={[
                    styles.weekDot,
                    studied
                      ? { backgroundColor: colors.primary, borderColor: colors.primary }
                      : day.frozen
                        ? { backgroundColor: freezeCellBg, borderColor: freezeCellBorder }
                        : {
                            backgroundColor: 'transparent',
                            borderColor: day.isToday ? colors.primary : colors.border,
                            borderWidth: day.isToday ? 2 : 1,
                            opacity: day.isFuture ? 0.4 : 1,
                          },
                  ]}
                >
                  <ThemedText
                    variant="caption"
                    style={{
                      color: studied ? colors.primaryText : day.frozen ? colors.primaryText : colors.textMuted,
                      fontWeight: '700',
                      fontSize: 11,
                    }}
                  >
                    {studied ? '✓' : day.frozen ? '❄' : day.isToday ? '・' : ''}
                  </ThemedText>
                </View>
                <ThemedText
                  variant="caption"
                  color={day.isToday ? 'primary' : 'muted'}
                  style={day.isToday ? styles.todayLabel : undefined}
                >
                  {day.weekdayLabel}
                </ThemedText>
              </View>
            );
          })}
        </View>

        <ThemedText variant="caption" color="muted">
          {streakHint}
        </ThemedText>
      </View>

      {/* ブロック 3: 学習サマリ (1カード 2x2) */}
      {hasData ? (
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
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
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <ThemedText variant="heading">まだ記録がありません</ThemedText>
          <ThemedText variant="caption" color="muted">
            レッスンを再生すると、学習時間やシャドーイングの記録がここに表示されます。
          </ThemedText>
          <Pressable
            onPress={() => router.push('/(tabs)')}
            accessibilityRole="button"
            style={[styles.primaryCta, { backgroundColor: colors.primary }]}
          >
            <ThemedText style={{ color: colors.primaryText, fontWeight: '700' }}>
              ライブラリを開く
            </ThemedText>
          </Pressable>
        </View>
      )}

      {/* ブロック 4: 学習カレンダー (7行=月〜日 × 12週列の整列グリッド) */}
      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <ThemedText variant="heading">学習カレンダー (直近 12 週)</ThemedText>

        <View style={styles.calendarMonthRow}>
          <View style={styles.weekdayAxisSpacer} />
          <View style={styles.calendarWeekCols}>
            {weeklyGrid.map((col) => (
              <View key={col.weekStart} style={styles.monthLabelCell}>
                {col.monthLabel ? (
                  <ThemedText variant="caption" color="muted" style={styles.monthLabelText}>
                    {col.monthLabel}
                  </ThemedText>
                ) : null}
              </View>
            ))}
          </View>
        </View>

        <View style={styles.calendarBodyRow}>
          <View style={styles.weekdayAxisCol}>
            {WEEKDAY_ROW_LABELS.map((label, idx) => (
              <View key={label} style={styles.weekdayAxisCell}>
                {idx % 2 === 0 ? (
                  <ThemedText variant="caption" color="muted" style={styles.weekdayAxisText}>
                    {label}
                  </ThemedText>
                ) : null}
              </View>
            ))}
          </View>
          <View style={styles.calendarWeekCols}>
            {weeklyGrid.map((col) => (
              <View key={col.weekStart} style={styles.calendarWeekCol}>
                {col.days.map((cell) => {
                  if (cell.isFuture) {
                    return <View key={cell.date} style={[styles.heatCell, styles.futureCell]} />;
                  }
                  const isSelected = selectedDay?.date === cell.date;
                  return (
                    <Pressable
                      key={cell.date}
                      hitSlop={2}
                      onPress={() =>
                        setSelectedDay({
                          date: cell.date,
                          seconds: cell.seconds,
                          frozen: cell.frozen,
                        })
                      }
                      style={[
                        styles.heatCell,
                        cell.frozen
                          ? {
                              backgroundColor: freezeCellBg,
                              borderWidth: 1,
                              borderColor: freezeCellBorder,
                            }
                          : { backgroundColor: heatColor(cell.seconds) },
                        cell.isToday && !isSelected
                          ? { borderWidth: 1.5, borderColor: colors.primary }
                          : null,
                        isSelected ? { borderWidth: 2, borderColor: colors.primary } : null,
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={`${formatDayLabel(cell.date)}の学習記録: ${
                        cell.frozen
                          ? 'フリーズで保護'
                          : cell.seconds > 0
                            ? formatMinutes(cell.seconds)
                            : '記録なし'
                      }`}
                    />
                  );
                })}
              </View>
            ))}
          </View>
        </View>

        <ThemedText variant="caption" color="muted">
          {selectedDay
            ? `${formatDayLabel(selectedDay.date)}: ${
                selectedDay.frozen
                  ? '❄ フリーズで連続記録を保護'
                  : selectedDay.seconds > 0
                    ? formatMinutes(selectedDay.seconds)
                    : '記録なし'
              }`
            : 'セルをタップすると、その日の学習時間や保護状況が見られます'}
        </ThemedText>
        <View style={styles.heatLegend}>
          <ThemedText variant="caption" color="muted">
            少
          </ThemedText>
          {colors.heatLevels.map((c) => (
            <View key={c} style={[styles.heatCell, styles.heatLegendCell, { backgroundColor: c }]} />
          ))}
          <ThemedText variant="caption" color="muted">
            多
          </ThemedText>
          <View
            style={[
              styles.heatCell,
              styles.heatLegendCell,
              styles.freezeLegendGap,
              {
                backgroundColor: freezeCellBg,
                borderWidth: 1,
                borderColor: freezeCellBorder,
              },
            ]}
          />
          <ThemedText variant="caption" color="muted">
            保護
          </ThemedText>
        </View>
      </View>

      {/* ブロック 5: 詳細な弱点分析カード (P4 水平ゲージ可視化 / セカンダリ枠線 CTA で P1 準拠) */}
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
              weakByType.map(([type, count]) => {
                const typeColor = getLinkingColor(type, scheme);
                const ratio = count / maxWeakCount;
                return (
                  <View key={type} style={styles.weakBarBlock}>
                    <View style={styles.missedRow}>
                      <ThemedText
                        variant="caption"
                        style={[
                          styles.weakLabel,
                          { color: typeColor, textDecorationColor: typeColor },
                          LINKING_TEXT_DECORATIONS[type],
                        ]}
                      >
                        {LINKING_LABELS[type] ?? type}
                      </ThemedText>
                      <ThemedText variant="caption" color="muted">
                        {count} 件
                      </ThemedText>
                    </View>
                    <View style={[styles.weakTrack, { backgroundColor: colors.border }]}>
                      <View
                        style={[
                          styles.weakFill,
                          { width: `${ratio * 100}%`, backgroundColor: typeColor },
                        ]}
                      />
                    </View>
                  </View>
                );
              })
            ) : (
              <ThemedText variant="caption" color="muted">
                苦手フレーズを登録すると、音の変化のタイプ別にグラフで集計されます。
              </ThemedText>
            )}
            <ThemedText variant="caption" color="muted">
              苦手フレーズ帳 ({weakSentences.length} 件) に基づく分析です。
            </ThemedText>
          </>
        ) : (
          <>
            <ThemedText variant="caption" color="muted">
              {weakSentences.length > 0
                ? `現在 ${weakSentences.length} 件の苦手フレーズを記録中。プレミアムでは種類別の傾向グラフを確認できます。`
                : 'プレミアムでは、苦手フレーズと学習履歴に基づいた詳細な種類別分析が利用できます。'}
            </ThemedText>
            <Pressable
              onPress={() => router.push('/paywall?from=progress')}
              hitSlop={6}
              accessibilityRole="button"
              style={[styles.secondaryOutline, { borderColor: colors.primary }]}
            >
              <ThemedText variant="caption" color="primary" style={styles.secondaryLabel}>
                プレミアムについて見る
              </ThemedText>
            </Pressable>
          </>
        )}
      </View>

      <DailyGoalSheet
        visible={goalSheetVisible}
        currentMinutes={dailyGoalMinutes}
        onSelectGoal={setDailyGoalMinutes}
        onClose={() => setGoalSheetVisible(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    marginTop: 4,
    marginBottom: 12,
  },
  firstCard: {
    marginTop: 0,
  },
  lastCard: {
    marginBottom: 16,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 8,
    marginTop: 12,
  },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  changeText: {
    fontWeight: '700',
  },
  goalMetricRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  goalTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  goalFill: {
    height: 8,
    borderRadius: 4,
  },
  streakTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  freezePill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  weekStripRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  weekStripItem: {
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  weekDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayLabel: {
    fontWeight: '700',
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
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 2,
    marginTop: 8,
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
  calendarMonthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  weekdayAxisSpacer: {
    width: 16,
  },
  calendarBodyRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 6,
  },
  weekdayAxisCol: {
    width: 16,
    gap: 4,
  },
  weekdayAxisCell: {
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  weekdayAxisText: {
    fontSize: 10,
    lineHeight: 14,
  },
  calendarWeekCols: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  monthLabelCell: {
    width: 16,
    height: 16,
    overflow: 'visible',
  },
  monthLabelText: {
    fontSize: 10,
    lineHeight: 14,
    width: 28,
  },
  calendarWeekCol: {
    gap: 4,
  },
  heatCell: {
    width: 16,
    height: 16,
    borderRadius: 3,
  },
  futureCell: {
    opacity: 0,
  },
  heatLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  heatLegendCell: {
    width: 12,
    height: 12,
  },
  freezeLegendGap: {
    marginLeft: 10,
  },
  weakBarBlock: {
    gap: 4,
    marginTop: 2,
  },
  missedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weakLabel: {
    fontWeight: '700',
  },
  weakTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  weakFill: {
    height: 6,
    borderRadius: 3,
  },
});
