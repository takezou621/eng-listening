import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { SEEK_TOLERANCE_MILLIS } from '@/config/appConfig';
import {
  LINKING_LABELS,
  getLinkingColor,
} from '@/features/lesson/linkingViz';
import { getLessonList } from '@/features/lesson/registry';
import type { LessonLinkingNote, LessonSentence } from '@/features/lesson/types';
import { useUserData } from '@/features/library/userStore';
import { useTheme } from '@/theme/AppThemeProvider';

type LinkingNoteType = LessonLinkingNote['type'];

interface ResolvableWeakItem {
  lessonId: string;
  sentenceIndex: number;
  addedAtMs: number;
  titleJa: string;
  audio: number;
  sentence: LessonSentence;
  uniqueTypes: LinkingNoteType[];
}

/** 苦手フレーズ帳（即聴き直し・即シャドーイング復習ループ付き） */
export default function PhrasesScreen() {
  const { scheme, colors } = useTheme();
  const router = useRouter();
  const { weakSentences, toggleWeakSentence } = useUserData();
  const [playingKey, setPlayingKey] = useState<string | null>(null);

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
      });
    }
    return items;
  }, [weakSentences, lessonList]);

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

  const firstReviewTarget = resolvableWeakItems[0] ?? null;

  return (
    <Screen scroll={false}>
      <ThemedText variant="title">苦手フレーズ</ThemedText>
      <ThemedText variant="caption" color="muted" style={styles.subtitle}>
        全 {resolvableWeakItems.length} 件 ・ 聞いてすぐシャドーイング復習
      </ThemedText>

      <FlatList
        data={resolvableWeakItems}
        keyExtractor={(item) => `${item.lessonId}-${item.sentenceIndex}`}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          firstReviewTarget ? (
            <Pressable
              onPress={() => {
                stopPlayback();
                router.push(
                  `/lesson?lesson=${firstReviewTarget.lessonId}&sentence=${firstReviewTarget.sentenceIndex + 1}&mode=speak`
                );
              }}
              accessibilityRole="button"
              accessibilityLabel={`最初のフレーズ「${firstReviewTarget.sentence.text}」をシャドーイング復習`}
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
                最初のフレーズをシャドーイング復習
              </ThemedText>
            </Pressable>
          ) : undefined
        }
        ListEmptyComponent={
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
                  <ThemedText variant="caption" color="muted">
                    {new Date(item.addedAtMs).toLocaleDateString('ja-JP')}
                  </ThemedText>
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
                          <View style={[styles.typeDot, { backgroundColor: typeColor }]} />
                          <ThemedText
                            variant="caption"
                            style={[styles.typeBadgeText, { color: typeColor }]}
                          >
                            {LINKING_LABELS[type]}
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    marginTop: 4,
    marginBottom: 12,
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
