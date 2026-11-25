import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { Chip } from '@/components/Chip';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { SEEK_TOLERANCE_MILLIS } from '@/config/appConfig';
import {
  ReviewQueueSheet,
  type ReviewQueueCardItem,
} from '@/features/learning/components/ReviewQueueSheet';
import {
  GRADUATION_STAGE,
  formatReviewStatusLabel,
  isWeakDueForReview,
  isWeakGraduated,
  summarizeReviewQueue,
} from '@/features/learning/spacedRepetition';
import {
  LINKING_LABELS,
  LINKING_SYMBOLS,
  getLinkingColor,
} from '@/features/lesson/linkingViz';
import { getLessonList } from '@/features/lesson/registry';
import type { LessonLinkingNote, LessonSentence } from '@/features/lesson/types';
import { useUserData } from '@/features/library/userStore';
import { useTheme } from '@/theme/AppThemeProvider';

type LinkingNoteType = LessonLinkingNote['type'];
type FilterMode = 'all' | 'due' | 'graduated';

interface ResolvableWeakItem {
  lessonId: string;
  sentenceIndex: number;
  addedAtMs: number;
  titleJa: string;
  audio: number;
  sentence: LessonSentence;
  uniqueTypes: LinkingNoteType[];
  reviewStage: number;
  nextReviewAtMs?: number;
  graduatedAtMs?: number;
  graduated: boolean;
  due: boolean;
  statusLabel: string;
}

/** 苦手フレーズ帳 & 間隔反復復習キュー（残り件数・卒業数可視化 + 1タップ連続復習） */
export default function PhrasesScreen() {
  const params = useLocalSearchParams<{ review?: string | string[] }>();
  const reviewParam = Array.isArray(params.review) ? params.review[0] : params.review;
  const { scheme, colors } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const {
    weakSentences,
    diagnosticProfile,
    toggleWeakSentence,
    recordWeakSentenceReview,
    reactivateWeakSentence,
  } = useUserData();
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [reviewSheetVisible, setReviewSheetVisible] = useState(false);
  const [autoReviewPending, setAutoReviewPending] = useState(reviewParam === '1');
  const [prevReviewParam, setPrevReviewParam] = useState(reviewParam);
  if (prevReviewParam !== reviewParam) {
    setPrevReviewParam(reviewParam);
    setAutoReviewPending(reviewParam === '1');
  }

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNowMs(Date.now());
    });
    const timer = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, []);

  const playerRef = useRef<AudioPlayer | null>(null);
  const subRef = useRef<{ remove: () => void } | null>(null);
  const playTokenRef = useRef(0);

  const lessonList = getLessonList();

  const stopPlayback = useCallback(() => {
    playTokenRef.current += 1;
    subRef.current?.remove();
    subRef.current = null;
    const current = playerRef.current;
    playerRef.current = null;
    if (current) {
      try {
        current.pause();
      } catch {}
      try {
        current.release();
      } catch {}
    }
    setPlayingKey(null);
  }, []);

  useEffect(() => {
    return () => {
      stopPlayback();
    };
  }, [stopPlayback]);

  const resolvableWeakItems = useMemo<ResolvableWeakItem[]>(() => {
    const items: ResolvableWeakItem[] = [];
    for (const item of weakSentences) {
      const bundle = lessonList.find((l) => l.entry.id === item.lessonId)?.bundle;
      if (!bundle) continue;
      const sentence = bundle.data.sentences.find((s) => s.index === item.sentenceIndex);
      if (!sentence) continue;
      const seen = new Set<LinkingNoteType>();
      const uniqueTypes: LinkingNoteType[] = [];
      for (const note of sentence.linking) {
        if (!seen.has(note.type)) {
          seen.add(note.type);
          uniqueTypes.push(note.type);
        }
      }
      items.push({
        lessonId: item.lessonId,
        sentenceIndex: item.sentenceIndex,
        addedAtMs: item.addedAtMs,
        titleJa: bundle.data.titleJa,
        audio: bundle.audio,
        sentence,
        uniqueTypes: uniqueTypes.slice(0, 3),
        reviewStage: item.reviewStage ?? 0,
        nextReviewAtMs: item.nextReviewAtMs,
        graduatedAtMs: item.graduatedAtMs,
        graduated: isWeakGraduated(item),
        due: isWeakDueForReview(item, nowMs),
        statusLabel: formatReviewStatusLabel(item, nowMs),
      });
    }
    return items;
  }, [weakSentences, lessonList, nowMs]);

  const reviewSummary = useMemo(
    () => summarizeReviewQueue(resolvableWeakItems, nowMs),
    [resolvableWeakItems, nowMs]
  );

  // 診断由来の弱点音変化タイプと推薦レッスンを情報源として取得
  const diagnosticWeakTypes = useMemo(() => {
    return (
      diagnosticProfile?.weakSoundTypes ??
      (diagnosticProfile?.missedTypes
        ? Object.entries(diagnosticProfile.missedTypes)
            .sort((a, b) => b[1] - a[1])
            .map(([t]) => t as LinkingNoteType)
        : [])
    );
  }, [diagnosticProfile]);
  const diagnosticRecommendedLessonId = diagnosticProfile?.recommendedLessonId ?? null;

  // 診断由来の弱点タイプ・推薦レッスンに基づく優先度スコア (高いほど優先)
  const computeDiagnosticPriority = useCallback(
    (item: ResolvableWeakItem): number => {
      let score = 0;
      if (diagnosticRecommendedLessonId && item.lessonId === diagnosticRecommendedLessonId) {
        score += 10;
      }
      if (diagnosticWeakTypes.length > 0) {
        for (const t of item.uniqueTypes) {
          const rank = diagnosticWeakTypes.indexOf(t);
          if (rank >= 0) {
            score += Math.max(1, diagnosticWeakTypes.length - rank);
          }
        }
      }
      return score;
    },
    [diagnosticRecommendedLessonId, diagnosticWeakTypes]
  );

  const filteredItems = useMemo(() => {
    let list: ResolvableWeakItem[];
    if (filterMode === 'due') {
      list = [...reviewSummary.dueItems];
    } else if (filterMode === 'graduated') {
      list = [...reviewSummary.graduatedItems];
    } else {
      list = [...resolvableWeakItems];
    }
    // 診断結果との接続: 弱点音変化タイプ・推薦レッスンを含むフレーズを同ステータス内で優先提示
    if (diagnosticWeakTypes.length > 0 || diagnosticRecommendedLessonId) {
      list.sort((a, b) => {
        // ステータス(due/graduated/upcoming)の基本順は維持
        if (a.due !== b.due) return a.due ? -1 : 1;
        if (a.graduated !== b.graduated) return a.graduated ? 1 : -1;
        const prioDiff = computeDiagnosticPriority(b) - computeDiagnosticPriority(a);
        if (prioDiff !== 0) return prioDiff;
        return (a.nextReviewAtMs ?? a.addedAtMs) - (b.nextReviewAtMs ?? b.addedAtMs);
      });
    }
    return list;
  }, [
    filterMode,
    reviewSummary.dueItems,
    reviewSummary.graduatedItems,
    resolvableWeakItems,
    diagnosticWeakTypes,
    diagnosticRecommendedLessonId,
    computeDiagnosticPriority,
  ]);

  const dueQueueCardItems = useMemo<ReviewQueueCardItem[]>(() => {
    let items = [...reviewSummary.dueItems];
    if (diagnosticWeakTypes.length > 0 || diagnosticRecommendedLessonId) {
      items.sort((a, b) => {
        const prioDiff = computeDiagnosticPriority(b) - computeDiagnosticPriority(a);
        if (prioDiff !== 0) return prioDiff;
        return (a.nextReviewAtMs ?? a.addedAtMs) - (b.nextReviewAtMs ?? b.addedAtMs);
      });
    }
    return items.map((it) => ({
      lessonId: it.lessonId,
      sentenceIndex: it.sentenceIndex,
      titleJa: it.titleJa,
      audio: it.audio,
      sentence: it.sentence,
      uniqueTypes: it.uniqueTypes,
      reviewStage: it.reviewStage,
    }));
  }, [reviewSummary.dueItems, diagnosticWeakTypes, diagnosticRecommendedLessonId, computeDiagnosticPriority]);

  const handleTogglePlay = useCallback(
    async (item: ResolvableWeakItem) => {
      const key = `${item.lessonId}:${item.sentenceIndex}`;
      if (playingKey === key) {
        stopPlayback();
        return;
      }

      stopPlayback();
      const token = playTokenRef.current;
      setPlayingKey(key);

      try {
        await setAudioModeAsync({ playsInSilentMode: true });
        if (playTokenRef.current !== token) return;

        const player = createAudioPlayer(item.audio);
        if (playTokenRef.current !== token) {
          try {
            player.release();
          } catch {}
          return;
        }
        playerRef.current = player;

        await player.seekTo(
          item.sentence.startSec,
          SEEK_TOLERANCE_MILLIS,
          SEEK_TOLERANCE_MILLIS
        );
        if (playTokenRef.current !== token) return;

        let stopped = false;
        subRef.current = player.addListener('playbackStatusUpdate', (st) => {
          if (playTokenRef.current !== token || stopped) return;
          if (st.didJustFinish || st.currentTime >= item.sentence.endSec) {
            stopped = true;
            stopPlayback();
          }
        });
        player.play();
      } catch {
        if (playTokenRef.current === token) {
          stopPlayback();
        }
      }
    },
    [playingKey, stopPlayback]
  );

  const firstActiveTarget =
    reviewSummary.dueItems[0] ?? reviewSummary.upcomingItems[0] ?? null;

  const effectiveReviewSheetVisible =
    pathname === '/phrases' &&
    (reviewSheetVisible || (autoReviewPending && dueQueueCardItems.length > 0));

  return (
    <Screen scroll={false}>
      <ThemedText variant="title">苦手フレーズ</ThemedText>
      <ThemedText variant="caption" color="muted" style={styles.subtitle}>
        今日の復習 残り {reviewSummary.dueCount} 件 ・ 学習中 {reviewSummary.activeCount} 件 ・ 卒業{' '}
        {reviewSummary.graduatedCount} 件
      </ThemedText>

      {resolvableWeakItems.length > 0 ? (
        <View style={styles.filterRow}>
          <Chip
            label={`すべて (${resolvableWeakItems.length})`}
            variant="outlined"
            active={filterMode === 'all'}
            onPress={() => setFilterMode('all')}
          />
          <Chip
            label={`今日復習 (${reviewSummary.dueCount})`}
            variant="outlined"
            active={filterMode === 'due'}
            onPress={() => setFilterMode('due')}
          />
          <Chip
            label={`卒業済み (${reviewSummary.graduatedCount})`}
            variant="outlined"
            active={filterMode === 'graduated'}
            onPress={() => setFilterMode('graduated')}
          />
        </View>
      ) : null}

      <FlatList
        data={filteredItems}
        keyExtractor={(item) => `${item.lessonId}-${item.sentenceIndex}`}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          reviewSummary.dueCount > 0 ? (
            <Pressable
              onPress={() => {
                stopPlayback();
                setReviewSheetVisible(true);
              }}
              accessibilityRole="button"
              accessibilityLabel={`今日の復習をはじめる 残り ${reviewSummary.dueCount} 件`}
              style={[styles.primaryCta, { backgroundColor: colors.primary }]}
            >
              <SymbolView
                name="play.fill"
                size={14}
                tintColor={colors.primaryText}
                fallback={
                  <ThemedText variant="caption" style={{ color: colors.primaryText, fontWeight: '700' }}>
                    ▶
                  </ThemedText>
                }
              />
              <ThemedText style={[styles.primaryCtaText, { color: colors.primaryText }]}>
                今日の復習をはじめる（残り {reviewSummary.dueCount} 件）
              </ThemedText>
            </Pressable>
          ) : firstActiveTarget ? (
            <Pressable
              onPress={() => {
                stopPlayback();
                router.push(
                  `/lesson?lesson=${firstActiveTarget.lessonId}&sentence=${firstActiveTarget.sentenceIndex + 1}&mode=speak`
                );
              }}
              accessibilityRole="button"
              accessibilityLabel={`学習中フレーズ「${firstActiveTarget.sentence.text}」をシャドーイング復習`}
              style={[styles.primaryCta, { backgroundColor: colors.primary }]}
            >
              <SymbolView
                name="mic.fill"
                size={15}
                tintColor={colors.primaryText}
                fallback={
                  <ThemedText variant="caption" style={{ color: colors.primaryText, fontWeight: '700' }}>
                    ●
                  </ThemedText>
                }
              />
              <ThemedText style={[styles.primaryCtaText, { color: colors.primaryText }]}>
                シャドーイングで先取り練習
              </ThemedText>
            </Pressable>
          ) : undefined
        }
        ListEmptyComponent={
          resolvableWeakItems.length > 0 ? (
            <View
              style={[
                styles.emptyCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <ThemedText variant="heading">
                {filterMode === 'due' ? '今日の復習は完了しました' : '卒業済みフレーズはまだありません'}
              </ThemedText>
              <ThemedText variant="caption" color="muted" style={styles.emptyHint}>
                {filterMode === 'due'
                  ? '3回連続で聞き取れると卒業します。「すべて」から他のフレーズも確認できます。'
                  : '復習キューで 3 回連続「聞き取れた」を達成すると卒業済みになります。'}
              </ThemedText>
            </View>
          ) : (
            <View
              style={[
                styles.emptyCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <ThemedText variant="heading">登録された苦手フレーズはありません</ThemedText>
              <ThemedText variant="caption" color="muted" style={styles.emptyHint}>
                レッスンの各文にある苦手アイコンをタップすると、聞き取れなかった文をここに集められます。
              </ThemedText>
              <Pressable
                onPress={() => router.push('/(tabs)')}
                hitSlop={8}
                style={[styles.emptyCta, { borderColor: colors.primary }]}
                accessibilityRole="button"
              >
                <ThemedText variant="caption" color="primary" style={styles.emptyCtaText}>
                  ライブラリを開く
                </ThemedText>
              </Pressable>
            </View>
          )
        }
        renderItem={({ item }) => {
          const itemKey = `${item.lessonId}:${item.sentenceIndex}`;
          const isPlaying = playingKey === itemKey;

          return (
            <View
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Pressable
                onPress={() => {
                  stopPlayback();
                  router.push(
                    `/lesson?lesson=${item.lessonId}&sentence=${item.sentenceIndex + 1}`
                  );
                }}
                accessibilityRole="button"
                accessibilityLabel={`${item.sentence.text}（${item.titleJa}）`}
                accessibilityHint="タップでこの文をレッスンで開く"
                style={styles.cardBodyPressable}
              >
                <View style={styles.metaTopRow}>
                  <ThemedText variant="caption" color="primary" numberOfLines={1} style={styles.lessonTitle}>
                    {item.titleJa}
                  </ThemedText>
                  <View style={styles.statusGroup}>
                    <View style={styles.stageDots}>
                      {Array.from({ length: GRADUATION_STAGE }).map((_, idx) => (
                        <View
                          key={idx}
                          style={[
                            styles.stageDot,
                            {
                              backgroundColor:
                                item.graduated || idx < item.reviewStage
                                  ? colors.success
                                  : colors.border,
                            },
                          ]}
                        />
                      ))}
                    </View>
                    <ThemedText
                      variant="caption"
                      style={{
                        color: item.graduated
                          ? colors.success
                          : item.due
                            ? colors.primary
                            : colors.textMuted,
                        fontWeight: '600',
                      }}
                    >
                      {item.statusLabel}
                    </ThemedText>
                  </View>
                </View>

                <ThemedText variant="heading">{item.sentence.text}</ThemedText>
                <ThemedText variant="caption" color="muted">
                  {item.sentence.translationJa}
                </ThemedText>

                {item.uniqueTypes.length > 0 ? (
                  <View style={styles.badgeRow}>
                    {item.uniqueTypes.map((type) => {
                      const typeColor = getLinkingColor(type, scheme);
                      return (
                        <View
                          key={type}
                          style={[
                            styles.typeBadge,
                            { backgroundColor: colors.surface, borderColor: colors.border },
                          ]}
                        >
                          <ThemedText
                            variant="caption"
                            style={[styles.typeBadgeText, { color: typeColor }]}
                          >
                            {LINKING_SYMBOLS[type]} {LINKING_LABELS[type]}
                          </ThemedText>
                        </View>
                      );
                    })}
                  </View>
                ) : null}
              </Pressable>

              <View style={[styles.actionRow, { borderTopColor: colors.border }]}>
                <View style={styles.actionLeftGroup}>
                  <Pressable
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={
                      isPlaying ? `${item.sentence.text}の再生を停止` : `${item.sentence.text}を聞く`
                    }
                    onPress={() => void handleTogglePlay(item)}
                    style={[
                      styles.actionBtn,
                      {
                        backgroundColor: isPlaying ? colors.secondarySurface : colors.surface,
                        borderColor: isPlaying ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <SymbolView
                      name={isPlaying ? 'stop.fill' : 'play.fill'}
                      size={12}
                      tintColor={colors.primary}
                      fallback={
                        <ThemedText variant="caption" color="primary" style={{ fontWeight: '700' }}>
                          {isPlaying ? '■' : '▶'}
                        </ThemedText>
                      }
                    />
                    <ThemedText variant="caption" color="primary" style={styles.actionBtnText}>
                      {isPlaying ? '停止' : '聞く'}
                    </ThemedText>
                  </Pressable>

                  <Pressable
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.sentence.text}をシャドーイングで話す`}
                    onPress={() => {
                      stopPlayback();
                      router.push(
                        `/lesson?lesson=${item.lessonId}&sentence=${item.sentenceIndex + 1}&mode=speak`
                      );
                    }}
                    style={[
                      styles.actionBtn,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                    ]}
                  >
                    <SymbolView
                      name="mic.fill"
                      size={12}
                      tintColor={colors.primary}
                      fallback={
                        <ThemedText variant="caption" color="primary" style={{ fontWeight: '700' }}>
                          ●
                        </ThemedText>
                      }
                    />
                    <ThemedText variant="caption" color="primary" style={styles.actionBtnText}>
                      話す
                    </ThemedText>
                  </Pressable>

                  {item.graduated ? (
                    <Pressable
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel={`${item.sentence.text}を再復習に戻す`}
                      onPress={() => reactivateWeakSentence(item.lessonId, item.sentenceIndex)}
                      style={[
                        styles.actionBtn,
                        { backgroundColor: colors.surface, borderColor: colors.border },
                      ]}
                    >
                      <ThemedText variant="caption" color="muted" style={styles.actionBtnText}>
                        再復習
                      </ThemedText>
                    </Pressable>
                  ) : item.due ? (
                    <Pressable
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel={`${item.sentence.text}を聞き取れたとして次へ進める`}
                      onPress={() => recordWeakSentenceReview(item.lessonId, item.sentenceIndex, true)}
                      style={[
                        styles.actionBtn,
                        { backgroundColor: colors.surface, borderColor: colors.success },
                      ]}
                    >
                      <ThemedText variant="caption" style={{ color: colors.success, fontWeight: '700' }}>
                        ✓ 覚えた
                      </ThemedText>
                    </Pressable>
                  ) : null}
                </View>

                <Pressable
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="苦手フレーズから外す"
                  onPress={() => {
                    if (playingKey === itemKey) {
                      stopPlayback();
                    }
                    toggleWeakSentence(item.lessonId, item.sentenceIndex);
                  }}
                  style={styles.removeBtn}
                >
                  <ThemedText variant="caption" color="muted" style={styles.removeText}>
                    外す
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          );
        }}
      />

      <ReviewQueueSheet
        visible={effectiveReviewSheetVisible}
        dueItems={dueQueueCardItems}
        graduatedCount={reviewSummary.graduatedCount}
        onRecordOutcome={recordWeakSentenceReview}
        onPracticeSpeak={(lessonId, sentenceIndex) => {
          setAutoReviewPending(false);
          setReviewSheetVisible(false);
          router.push(`/lesson?lesson=${lessonId}&sentence=${sentenceIndex + 1}&mode=speak`);
        }}
        onClose={() => {
          setAutoReviewPending(false);
          setReviewSheetVisible(false);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    marginTop: 4,
    marginBottom: 10,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  statusGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stageDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  stageDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  list: {
    paddingBottom: 24,
    gap: 12,
  },
  primaryCta: {
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryCtaText: {
    fontSize: 15,
    fontWeight: '700',
  },
  emptyCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 8,
    marginTop: 8,
    alignItems: 'center',
  },
  emptyHint: {
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyCta: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 4,
    minHeight: 40,
    justifyContent: 'center',
  },
  emptyCtaText: {
    fontWeight: '700',
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  cardBodyPressable: {
    gap: 6,
  },
  metaTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  lessonTitle: {
    flexShrink: 1,
    fontWeight: '600',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  typeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  typeBadgeText: {
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    minHeight: 36,
  },
  actionBtnText: {
    fontWeight: '700',
  },
  removeBtn: {
    minHeight: 36,
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  removeText: {
    fontWeight: '600',
  },
});
