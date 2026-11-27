import { useEffect, useState, useMemo, useRef } from 'react';
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, View, AppState } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { Chip } from '@/components/Chip';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { CONTENT_TYPE_LABELS, type ContentType } from '@/data/types';
import { CurriculumSheet } from '@/features/learning/components/CurriculumSheet';
import { CurriculumCustomizeSheet } from '@/features/learning/components/CurriculumCustomizeSheet';
import {
  buildPersonalCurriculum,
  MAX_CURRICULUM_FOCUS_TYPES,
  type CurriculumCustomization,
} from '@/features/learning/curriculum';
import { summarizeReviewQueue } from '@/features/learning/spacedRepetition';
import { getLessonList, getTodaysLesson } from '@/features/lesson/registry';
import { isOnboardingDone, loadUserDataAsync, useUserData } from '@/features/library/userStore';
import { logEvent } from '@/features/analytics/analyticsStore';
import { openLessonWithResume, useLessonResumeData } from '@/features/player/lessonResumeStore';
import { useTheme } from '@/theme/AppThemeProvider';
import {
  computeDailyGoalStatus,
  computeStreakWithFreeze,
  computeTodaySeconds,
  localDateStr,
  useProgressData,
} from '@/features/progress/progressStore';

type FilterType = 'all' | ContentType;
type FilterLevel = 'all' | 'beginner' | 'intermediate';

function countLinkingNotes(
  bundle: { data: { sentences: { linking: unknown[] }[] } } | null | undefined
): number {
  if (!bundle) return 0;
  return bundle.data.sentences.reduce((sum, s) => sum + s.linking.length, 0);
}

export default function LibraryScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const {
    favoriteLessons,
    toggleFavoriteLesson,
    onboardingDone,
    dailyGoalMinutes,
    weakSentences,
    diagnosticProfile,
    curriculumCustom,
    setCurriculumCustom,
  } = useUserData();

  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterLevel, setFilterLevel] = useState<FilterLevel>('all');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  // レッスンごとの再開位置 (#97)。ホームの 3 箇所 (今日の1本 / レッスンカード / カリキュラム) で使う
  const lessonResume = useLessonResumeData();
  const openLesson = (lessonId: string) =>
    openLessonWithResume({
      lessonId,
      resumeAt: lessonResume[lessonId] ?? null,
      push: (path) => router.push(path as Href),
      alert: Alert.alert,
    });
  const [curriculumVisible, setCurriculumVisible] = useState(false);
  const [customizeVisible, setCustomizeVisible] = useState(false);

  // 直近の保存値を ref に同期しておく (レンダリング前の連続タップでも判定・計測を最新値ベースにする。
  // ハンドラー内でも書き込むため、描画前のギャップでは常に最後の書き込み値が参照される)
  const curriculumCustomRef = useRef<CurriculumCustomization | null>(
    curriculumCustom ?? null
  );
  useEffect(() => {
    curriculumCustomRef.current = curriculumCustom ?? null;
  }, [curriculumCustom]);
  const applyCurriculumCustom = (
    compute: (prev: CurriculumCustomization | null) => CurriculumCustomization | null
  ) => {
    const prev = curriculumCustomRef.current;
    curriculumCustomRef.current = compute(prev);
    setCurriculumCustom(compute);
  };

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
  const allBundles = useMemo(
    () =>
      lessonList
        .map((l) => l.bundle)
        .filter((b): b is NonNullable<typeof b> => b !== null),
    [lessonList]
  );
  const curriculum = useMemo(
    () =>
      buildPersonalCurriculum(
        diagnosticProfile?.missedTypes,
        completedLessonIds,
        allBundles,
        curriculumCustom
      ),
    [diagnosticProfile, completedLessonIds, allBundles, curriculumCustom]
  );
  // 初回未完了時・直近診断直後に推薦レッスンがあれば優先、なければカリキュラム順
  const preferredLessonId = useMemo(() => {
    if (
      diagnosticProfile?.recommendedLessonId &&
      !completedLessonIds.has(diagnosticProfile.recommendedLessonId)
    ) {
      return diagnosticProfile.recommendedLessonId;
    }
    return curriculum.nextLessonId;
  }, [diagnosticProfile, completedLessonIds, curriculum.nextLessonId]);

  const todaysLesson = useMemo(
    () => getTodaysLesson(completedLessonIds, preferredLessonId),
    [completedLessonIds, preferredLessonId]
  );
  // 日付をまたいでも「今日」が古くならないよう、復帰時と1分間隔で日付を更新する
  const [todayKey, setTodayKey] = useState(() => localDateStr());
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setTodayKey(localDateStr());
        setNowMs(Date.now());
      }
    });
    const interval = setInterval(() => {
      setTodayKey(localDateStr());
      setNowMs(Date.now());
    }, 60_000);
    return () => {
      sub.remove();
      clearInterval(interval);
    };
  }, []);
  const reviewSummary = useMemo(
    () => summarizeReviewQueue(weakSentences, nowMs),
    [weakSentences, nowMs]
  );
  const refDate = new Date(todayKey + 'T12:00:00');
  const streakInfo = computeStreakWithFreeze(progressDays, refDate);
  const goalStatus = computeDailyGoalStatus(
    computeTodaySeconds(progressDays, refDate),
    dailyGoalMinutes
  );
  const successColor = colors.success;
  const todayBundle = todaysLesson?.item.bundle ?? null;
  const todayNoteCount = countLinkingNotes(todayBundle);

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

  const isFilterDefault = filterType === 'all' && filterLevel === 'all' && !showFavoritesOnly;

  const renderFilterChips = () => (
    <View style={styles.filterSection}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
        <Chip
          label="すべて"
          variant="outlined"
          active={isFilterDefault}
          onPress={() => {
            setFilterType('all');
            setFilterLevel('all');
            setShowFavoritesOnly(false);
          }}
        />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Chip
          label="★ お気に入り"
          variant="outlined"
          active={showFavoritesOnly}
          onPress={() => setShowFavoritesOnly((prev) => !prev)}
        />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Chip
          label="会話"
          variant="outlined"
          active={filterType === 'conversation'}
          onPress={() =>
            setFilterType((prev) => (prev === 'conversation' ? 'all' : 'conversation'))
          }
        />
        <Chip
          label="モノローグ"
          variant="outlined"
          active={filterType === 'monologue'}
          onPress={() =>
            setFilterType((prev) => (prev === 'monologue' ? 'all' : 'monologue'))
          }
        />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Chip
          label="初級"
          variant="outlined"
          active={filterLevel === 'beginner'}
          onPress={() =>
            setFilterLevel((prev) => (prev === 'beginner' ? 'all' : 'beginner'))
          }
        />
        <Chip
          label="中級"
          variant="outlined"
          active={filterLevel === 'intermediate'}
          onPress={() =>
            setFilterLevel((prev) => (prev === 'intermediate' ? 'all' : 'intermediate'))
          }
        />
      </ScrollView>
    </View>
  );

  return (
    <Screen scroll={false}>
      <View style={styles.headerRow}>
        <View style={styles.headerTextGroup}>
          <ThemedText variant="title">ライブラリ</ThemedText>
          <ThemedText variant="caption" color="muted" style={styles.subtitle}>
            全 {lessonList.length} 本 ・ 完了 {completedLessonIds.size} 本
          </ThemedText>
        </View>
        <Pressable
          onPress={() => router.push('/(tabs)/progress')}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`連続学習 ${streakInfo.streak} 日、進捗画面を開く`}
          accessibilityHint="タップで進捗タブへ移動"
          style={[
            styles.streakPill,
            { backgroundColor: colors.secondarySurface, borderColor: colors.border },
          ]}
        >
          <SymbolView
            name="flame.fill"
            size={14}
            tintColor={streakInfo.streak > 0 ? colors.warning : colors.textMuted}
            fallback={
              <ThemedText
                variant="caption"
                style={{
                  color: streakInfo.streak > 0 ? colors.warning : colors.textMuted,
                  fontWeight: '700',
                }}
              >
                ●
              </ThemedText>
            }
          />
          <ThemedText
            variant="caption"
            style={[
              styles.streakText,
              { color: streakInfo.streak > 0 ? colors.text : colors.textMuted },
            ]}
          >
            {streakInfo.streak}日
          </ThemedText>
        </Pressable>
      </View>

      {isFilterDefault && todaysLesson ? (
        <View style={styles.heroStack}>
          <Pressable
            onPress={() => openLesson(todaysLesson.item.entry.id)}
            accessibilityRole="button"
            accessibilityLabel={`${todaysLesson.isReview ? '復習におすすめ' : '今日の1本'}: ${todayBundle?.data.titleJa ?? todaysLesson.item.entry.title}。今日の目標は ${goalStatus.todayMinutes} 分 / ${goalStatus.goalMinutes} 分${goalStatus.achieved ? '、目標達成' : ''}`}
            accessibilityHint="タップでレッスンをはじめる"
            style={[
              styles.todayCard,
              { backgroundColor: colors.secondarySurface, borderColor: colors.primary },
            ]}
          >
            <View style={styles.todayTopRow}>
              <ThemedText variant="caption" color="primary" style={{ fontWeight: '700' }}>
                {todaysLesson.isReview
                  ? '復習におすすめ'
                  : curriculum.isCustomizedByDiagnostic && curriculum.nextStepLabel
                    ? `今日の1本 ・ ${curriculum.nextStepLabel}`
                    : '今日の1本'}
              </ThemedText>
              {goalStatus.achieved ? (
                <View style={styles.goalStatusRow}>
                  <SymbolView
                    name="checkmark.circle.fill"
                    size={13}
                    tintColor={successColor}
                    fallback={
                      <ThemedText variant="caption" style={{ color: successColor, fontWeight: '700' }}>
                        ✓
                      </ThemedText>
                    }
                  />
                  <ThemedText variant="caption" style={{ color: successColor, fontWeight: '600' }}>
                    目標達成 ({goalStatus.todayMinutes}分)
                  </ThemedText>
                </View>
              ) : (
                <ThemedText variant="caption" style={{ color: colors.textMuted, fontWeight: '600' }}>
                  今日 {goalStatus.todayMinutes} / {goalStatus.goalMinutes} 分
                </ThemedText>
              )}
            </View>
            <ThemedText variant="heading">{todayBundle?.data.titleJa}</ThemedText>
            <ThemedText variant="caption" color="muted" numberOfLines={1}>
              {todaysLesson.item.entry.title}
            </ThemedText>
            {lessonResume[todaysLesson.item.entry.id] ? (
              <ThemedText variant="caption" color="primary" style={styles.resumeHint}>
                文 {lessonResume[todaysLesson.item.entry.id] + 1} から再開できます
              </ThemedText>
            ) : null}
            <ThemedText variant="caption" color="muted">
              約 {Math.round(todayBundle?.data.durationSec ?? 0)} 秒 ・{' '}
              {todayBundle?.data.sentences.length ?? 0} 文
              {todayNoteCount > 0 ? ` ・ 音変化 ${todayNoteCount} 箇所` : ''}
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
            <View style={[styles.todayPrimaryCta, { backgroundColor: colors.primary }]}>
              <SymbolView
                name="play.fill"
                size={13}
                tintColor={colors.primaryText}
                fallback={
                  <ThemedText variant="caption" style={{ color: colors.primaryText, fontWeight: '700' }}>
                    ▶
                  </ThemedText>
                }
              />
              <ThemedText style={[styles.todayPrimaryCtaText, { color: colors.primaryText }]}>
                はじめる
              </ThemedText>
            </View>
          </Pressable>

          <View style={styles.quickActionRow}>
            <Pressable
              onPress={() => {
                logEvent('curriculum_viewed', { from: 'home' });
                setCurriculumVisible(true);
              }}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="あなた向けカリキュラムを見る"
              style={[
                styles.quickActionCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <ThemedText variant="caption" color="primary" style={styles.quickActionTitle}>
                あなた向けカリキュラム
              </ThemedText>
              <ThemedText variant="caption" color="muted" numberOfLines={1}>
                3ステップの順序を見る ›
              </ThemedText>
            </Pressable>

            {weakSentences.length > 0 ? (
              <Pressable
                onPress={() => router.push('/(tabs)/phrases?review=1')}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={`今日の復習: 残り ${reviewSummary.dueCount} 件、卒業 ${reviewSummary.graduatedCount} 件`}
                style={[
                  styles.quickActionCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: reviewSummary.dueCount > 0 ? colors.primary : colors.border,
                  },
                ]}
              >
                <ThemedText
                  variant="caption"
                  color={reviewSummary.dueCount > 0 ? 'primary' : 'default'}
                  style={styles.quickActionTitle}
                >
                  今日の復習{reviewSummary.dueCount === 0 ? ' ✓' : ''}
                </ThemedText>
                <ThemedText variant="caption" color="muted" numberOfLines={1}>
                  残り {reviewSummary.dueCount} 件 ・ 卒業 {reviewSummary.graduatedCount} 件 ›
                </ThemedText>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      {renderFilterChips()}

      <FlatList
        data={filteredLessons}
        keyExtractor={({ entry }) => entry.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <ThemedText variant="heading">該当するレッスンがありません</ThemedText>
            <ThemedText variant="caption" color="muted" style={styles.emptyDesc}>
              絞り込み条件に一致するレッスンが見つかりませんでした。
            </ThemedText>
            <Pressable
              onPress={() => {
                setFilterType('all');
                setFilterLevel('all');
                setShowFavoritesOnly(false);
              }}
              hitSlop={8}
              style={[styles.emptyResetBtn, { borderColor: colors.primary }]}
              accessibilityRole="button"
            >
              <ThemedText variant="caption" color="primary" style={{ fontWeight: '700' }}>
                絞り込みをリセット
              </ThemedText>
            </Pressable>
          </View>
        }
        renderItem={({ item: { entry, bundle } }) => {
          const isFav = favoriteLessons.includes(entry.id);
          const noteCount = countLinkingNotes(bundle);
          return (
            <Pressable
              disabled={bundle === null}
              onPress={() => openLesson(entry.id)}
              accessibilityRole="button"
              accessibilityState={{ disabled: bundle === null }}
              accessibilityLabel={`${entry.titleJa}（${CONTENT_TYPE_LABELS[entry.type]}・${entry.level === 'beginner' ? '初級' : '中級'}${completedLessonIds.has(entry.id) ? '・完了済み' : ''}）${bundle ? `、約 ${bundle.data.durationSec.toFixed(0)} 秒・${bundle.data.sentences.length} 文` : '、準備中'}`}
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
                  <View style={[styles.badgeCompleted, { backgroundColor: colors.secondarySurface }]}>
                    <SymbolView
                      name="checkmark.circle.fill"
                      size={12}
                      tintColor={colors.success}
                      fallback={
                        <ThemedText variant="caption" style={{ color: colors.success, fontWeight: '700' }}>
                          ✓
                        </ThemedText>
                      }
                    />
                    <ThemedText variant="caption" style={{ color: colors.success, fontWeight: '700' }}>
                      完了
                    </ThemedText>
                  </View>
                ) : null}
                <Pressable
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel={isFav ? `${entry.titleJa}のお気に入りを解除` : `${entry.titleJa}をお気に入りに登録`}
                  accessibilityState={{ selected: isFav }}
                  onPress={() => toggleFavoriteLesson(entry.id)}
                  style={styles.favIcon}
                >
                  <SymbolView
                    name={isFav ? 'star.fill' : 'star'}
                    size={18}
                    tintColor={isFav ? colors.favorite : colors.textMuted}
                    fallback={
                      <ThemedText style={{ color: isFav ? colors.favorite : colors.textMuted, fontSize: 18 }}>
                        {isFav ? '★' : '☆'}
                      </ThemedText>
                    }
                  />
                </Pressable>
              </View>
              <ThemedText variant="heading">{entry.titleJa}</ThemedText>
              <ThemedText variant="caption" color="muted" numberOfLines={1}>
                {entry.title}
              </ThemedText>
              <ThemedText variant="caption" color="muted">
                {bundle
                  ? `約 ${bundle.data.durationSec.toFixed(0)} 秒 ・ ${bundle.data.sentences.length} 文${noteCount > 0 ? ` ・ 音変化 ${noteCount} 箇所` : ''}${lessonResume[entry.id] ? ` ・ 文 ${lessonResume[entry.id] + 1} から再開可` : ''}`
                  : '準備中'}
              </ThemedText>
            </Pressable>
          );
        }}
      />

      <CurriculumSheet
        visible={curriculumVisible}
        curriculum={curriculum}
        onSelectLesson={(lessonId) => openLesson(lessonId)}
        onClose={() => setCurriculumVisible(false)}
        isCustomized={curriculum.isCustomizedManually}
        onOpenCustomize={() => {
          setCurriculumVisible(false);
          setCustomizeVisible(true);
        }}
      />

      <CurriculumCustomizeSheet
        visible={customizeVisible}
        focusTypes={curriculumCustom?.focusTypes ?? []}
        levelFilter={curriculumCustom?.levelFilter ?? 'all'}
        onToggleType={(type) => {
          // 直近の書き込み値 (ref) を基に判定・計測する。レンダリング前の連続タップでも
          // 状態・計測の不一致が起きないようにする (保存自体は関数型更新で冪等に適用)
          const prev = curriculumCustomRef.current;
          const wasSelected = (prev?.focusTypes ?? []).includes(type);
          applyCurriculumCustom((p) => {
            const current = p?.focusTypes ?? [];
            const next = current.includes(type)
              ? current.filter((t) => t !== type)
              : [...current, type].slice(0, MAX_CURRICULUM_FOCUS_TYPES);
            return { focusTypes: next, levelFilter: p?.levelFilter ?? 'all' };
          });
          logEvent('curriculum_customized', {
            action: wasSelected ? 'clear_type' : 'select_type',
            sound_change_type: type,
          });
        }}
        onClearTypes={() => {
          // すでに空 (おまかせ) のときは状態変更も計測もしない
          if ((curriculumCustomRef.current?.focusTypes.length ?? 0) === 0) return;
          // おまかせチップ = 全タイプ解除。難易度は保持する (全面リセットは onResetAll)
          applyCurriculumCustom((prev) => ({
            focusTypes: [],
            levelFilter: prev?.levelFilter ?? 'all',
          }));
          logEvent('curriculum_customized', { action: 'clear_type' });
        }}
        onSetLevel={(level) => {
          // 選択済み難易度の再タップは無視する (計測ノイズと不要な永続化書き込みを防ぐ)
          if (level === (curriculumCustomRef.current?.levelFilter ?? 'all')) return;
          applyCurriculumCustom((prev) => ({
            focusTypes: prev?.focusTypes ?? [],
            levelFilter: level,
          }));
          logEvent('curriculum_customized', { action: 'set_level', level });
        }}
        onResetAll={() => {
          applyCurriculumCustom(() => null);
          logEvent('curriculum_customized', { action: 'reset_all' });
        }}
        onClose={() => setCustomizeVisible(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  resumeHint: { fontWeight: '600' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  headerTextGroup: {
    flex: 1,
    minWidth: 0,
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 7,
    minHeight: 36,
  },
  streakText: {
    fontWeight: '700',
  },
  todayCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 6,
  },
  heroStack: {
    gap: 8,
    marginBottom: 12,
  },
  quickActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  quickActionCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
  },
  quickActionTitle: {
    fontWeight: '700',
  },
  todayTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  goalStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
  todayPrimaryCta: {
    marginTop: 4,
    minHeight: 44,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  todayPrimaryCtaText: {
    fontSize: 15,
    fontWeight: '700',
  },
  subtitle: { marginTop: 2 },
  filterSection: { marginBottom: 10 },
  chipScroll: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 6 },
  divider: { width: 1, height: 24, marginHorizontal: 2 },
  list: { paddingBottom: 24, gap: 12 },
  emptyCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 8,
    marginTop: 24,
    alignItems: 'flex-start',
  },
  emptyDesc: {},
  emptyResetBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minHeight: 36,
    justifyContent: 'center',
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 8,
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
  badgeCompleted: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  favIcon: { marginLeft: 'auto' },
});
