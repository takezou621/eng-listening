import { useEffect, useState, useMemo, useRef } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Chip } from '@/components/Chip';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { CONTENT_TYPE_LABELS, type ContentType } from '@/data/types';
import { getLessonList, getTodaysLesson } from '@/features/lesson/registry';
import { isOnboardingDone, loadUserDataAsync, useUserData } from '@/features/library/userStore';
import { logEvent } from '@/features/analytics/analyticsStore';
import { useTheme } from '@/theme/AppThemeProvider';
import {
  computeDailyGoalStatus,
  computeTodaySeconds,
  useProgressData,
} from '@/features/progress/progressStore';

type FilterType = 'all' | ContentType;
type FilterLevel = 'all' | 'beginner' | 'intermediate';

export default function LibraryScreen() {
  const { scheme, colors } = useTheme();
  const router = useRouter();
  const { favoriteLessons, toggleFavoriteLesson, onboardingDone, dailyGoalMinutes } = useUserData();

  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterLevel, setFilterLevel] = useState<FilterLevel>('all');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  const lessonList = getLessonList();
  const progressDays = useProgressData();
  // 完了済みレッスンの集合 (進捗データの日別完了記録から復元)
  const completedLessonIds = useMemo(() => {
    const set = new Set<string>();
    for (const day of Object.values(progressDays)) {
      for (const id of day.completedLessons ?? []) set.add(id);
    }
    return set;
  }, [progressDays]);
  const todaysLesson = useMemo(
    () => getTodaysLesson(completedLessonIds),
    [completedLessonIds]
  );
  const goalStatus = computeDailyGoalStatus(
    computeTodaySeconds(progressDays),
    dailyGoalMinutes
  );
  const successColor = scheme === 'dark' ? '#4ADE80' : '#16A34A';

  // 初回起動時のみオンボーディング診断へ誘導する (完了状態は端末内に永続化)
  const redirectedRef = useRef(false);
  useEffect(() => {
    if (redirectedRef.current) return;
    void loadUserDataAsync().then(() => {
      if (redirectedRef.current) return;
      redirectedRef.current = true;
      // 分析イベント: 初回起動 (ログに app_first_open がない場合のみ記録される)
      logEvent('app_first_open');
      // 読み込み後の最新値を参照する (マウント時のクロージャ値 false を使わない)
      if (!isOnboardingDone()) {
        router.replace('/onboarding');
      }
    });
  }, [onboardingDone, router]);

  const filteredLessons = useMemo(() => {
    return lessonList.filter(({ entry }) => {
      if (filterType !== 'all' && entry.type !== filterType) return false;
      if (filterLevel !== 'all' && entry.level !== filterLevel) return false;
      if (showFavoritesOnly && !favoriteLessons.includes(entry.id)) return false;
      return true;
    });
  }, [lessonList, filterType, filterLevel, showFavoritesOnly, favoriteLessons]);

  const renderFilterChips = () => (
    <View style={styles.filterSection}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
        <Chip
          label="★ お気に入り"
          active={showFavoritesOnly}
          onPress={() => setShowFavoritesOnly(!showFavoritesOnly)}
        />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Chip
          label="すべて"
          active={filterType === 'all'}
          onPress={() => setFilterType('all')}
        />
        <Chip
          label="会話"
          active={filterType === 'conversation'}
          onPress={() => setFilterType('conversation')}
        />
        <Chip
          label="モノローグ"
          active={filterType === 'monologue'}
          onPress={() => setFilterType('monologue')}
        />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Chip
          label="初級"
          active={filterLevel === 'beginner'}
          onPress={() => setFilterLevel('beginner')}
        />
        <Chip
          label="中級"
          active={filterLevel === 'intermediate'}
          onPress={() => setFilterLevel('intermediate')}
        />
        <Chip
          label="レベルすべて"
          active={filterLevel === 'all'}
          onPress={() => setFilterLevel('all')}
        />
      </ScrollView>
    </View>
  );

  return (
    <Screen scroll={false}>
      <ThemedText variant="title">ライブラリ</ThemedText>
      <ThemedText variant="caption" color="muted" style={styles.subtitle}>
        全 {lessonList.length} 本
      </ThemedText>

      {filterType === 'all' && filterLevel === 'all' && !showFavoritesOnly && todaysLesson ? (
        <Pressable
          onPress={() => router.push(`/lesson?lesson=${todaysLesson.item.entry.id}`)}
          style={[
            styles.todayCard,
            { backgroundColor: colors.secondarySurface, borderColor: colors.primary },
          ]}
        >
          <View style={styles.todayTopRow}>
            <ThemedText variant="caption" color="primary" style={{ fontWeight: '700' }}>
              {todaysLesson.isReview ? '復習におすすめ' : '今日の1本'}
            </ThemedText>
            <ThemedText
              variant="caption"
              style={{
                color: goalStatus.achieved ? successColor : colors.textMuted,
                fontWeight: '600',
              }}
            >
              {goalStatus.achieved
                ? `✓ 目標達成 (${goalStatus.todayMinutes}分)`
                : `今日 ${goalStatus.todayMinutes} / ${goalStatus.goalMinutes} 分`}
            </ThemedText>
          </View>
          <ThemedText variant="heading">{todaysLesson.item.bundle?.data.titleJa}</ThemedText>
          <ThemedText variant="caption" color="muted">
            {todaysLesson.item.entry.title} ・ 約{' '}
            {Math.round(todaysLesson.item.bundle?.data.durationSec ?? 0)} 秒 /{' '}
            {todaysLesson.item.bundle?.data.sentences.length ?? 0} 文
          </ThemedText>
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
          <ThemedText color="primary" style={{ fontWeight: '700' }}>
            ▶ はじめる
          </ThemedText>
        </Pressable>
      ) : null}

      {renderFilterChips()}

      <FlatList
        data={filteredLessons}
        keyExtractor={({ entry }) => entry.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<ThemedText style={styles.empty}>条件に一致するレッスンがありません</ThemedText>}
        renderItem={({ item: { entry, bundle } }) => {
          const isFav = favoriteLessons.includes(entry.id);
          return (
            <Pressable
              disabled={bundle === null}
              onPress={() => router.push(`/lesson?lesson=${entry.id}`)}
              style={[
                styles.card,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  opacity: bundle === null ? 0.6 : 1,
                },
              ]}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.badgeType, { backgroundColor: colors.badgeTypeBg }]}>
                  <ThemedText variant="caption" style={{ color: colors.badgeTypeText }}>
                    {CONTENT_TYPE_LABELS[entry.type]}
                  </ThemedText>
                </View>
                <View style={[styles.badgeLevel, { backgroundColor: colors.secondarySurface }]}>
                  <ThemedText variant="caption" color="primary">
                    {entry.level === 'beginner' ? '初級' : '中級'}
                  </ThemedText>
                </View>
                {completedLessonIds.has(entry.id) ? (
                  <View style={[styles.badgeLevel, { backgroundColor: colors.secondarySurface }]}>
                    <ThemedText variant="caption" style={{ color: '#16A34A', fontWeight: '700' }}>
                      ✓ 完了
                    </ThemedText>
                  </View>
                ) : null}
                <Pressable
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`${entry.title}をお気に入りに登録`}
                  accessibilityState={{ selected: isFav }}
                  onPress={() => toggleFavoriteLesson(entry.id)}
                  style={styles.favIcon}
                >
                  <ThemedText style={{ color: isFav ? '#F59E0B' : colors.textMuted, fontSize: 18 }}>
                    {isFav ? '★' : '☆'}
                  </ThemedText>
                </Pressable>
              </View>
              <ThemedText variant="heading">{entry.title}</ThemedText>
              <ThemedText variant="caption" color="muted" numberOfLines={1}>
                {entry.titleJa}
              </ThemedText>
              <ThemedText variant="caption" color="muted">
                {bundle
                  ? `約 ${bundle.data.durationSec.toFixed(0)} 秒 ・ ${bundle.data.sentences.length} 文`
                  : '準備中'}
              </ThemedText>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  todayCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 6,
    marginBottom: 12,
  },
  todayTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  goalTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 2,
  },
  goalFill: {
    height: 6,
    borderRadius: 3,
  },
  subtitle: { marginTop: 4, marginBottom: 12 },
  filterSection: { marginBottom: 16 },
  chipScroll: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 8 },
  divider: { width: 1, height: 24, marginHorizontal: 4 },
  list: { paddingBottom: 24, gap: 10 },
  empty: { marginTop: 24, textAlign: 'center' },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badgeType: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  badgeLevel: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  favIcon: { marginLeft: 'auto' },
});
