import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { SymbolView } from 'expo-symbols';

import { BottomSheet } from '@/components/BottomSheet';
import { ThemedText } from '@/components/ThemedText';
import { SEEK_TOLERANCE_MILLIS } from '@/config/appConfig';
import { GRADUATION_STAGE } from '@/features/learning/spacedRepetition';
import {
  LINKING_LABELS,
  LINKING_SYMBOLS,
  getLinkingColor,
} from '@/features/lesson/linkingViz';
import type { LessonLinkingNote, LessonSentence } from '@/features/lesson/types';
import { useTheme } from '@/theme/AppThemeProvider';

export interface ReviewQueueCardItem {
  lessonId: string;
  sentenceIndex: number;
  titleJa: string;
  audio: number;
  sentence: LessonSentence;
  uniqueTypes: LessonLinkingNote['type'][];
  reviewStage: number;
}

/**
 * 今日の復習キュー 連続演習シート (W4 / Phase 1-D + Phase 2 統合)。
 * 検索練習 (Roediger & Karpicke 2006) に沿って既定で英文を隠し、
 * 音声確認 → 答え表示 →「聞き取れた / もう一度」で間隔更新と卒業を行う。
 */
export function ReviewQueueSheet({
  visible,
  dueItems,
  graduatedCount,
  onRecordOutcome,
  onPracticeSpeak,
  onClose,
}: {
  visible: boolean;
  dueItems: ReviewQueueCardItem[];
  graduatedCount: number;
  onRecordOutcome: (lessonId: string, sentenceIndex: number, remembered: boolean) => void;
  onPracticeSpeak: (lessonId: string, sentenceIndex: number) => void;
  onClose: () => void;
}) {
  const { scheme, colors } = useTheme();
  const [showText, setShowText] = useState(false);
  const [deferredKeys, setDeferredKeys] = useState<string[]>([]);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const playerRef = useRef<AudioPlayer | null>(null);
  const subRef = useRef<{ remove: () => void } | null>(null);
  const playTokenRef = useRef(0);

  const [prevVisible, setPrevVisible] = useState(visible);
  if (prevVisible !== visible) {
    setPrevVisible(visible);
    if (!visible) {
      setIsPlaying(false);
    }
  }

  const releasePlayer = useCallback(() => {
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
  }, []);

  const stopPlayback = useCallback(() => {
    releasePlayer();
    setIsPlaying(false);
  }, [releasePlayer]);

  useEffect(() => {
    if (!visible) {
      releasePlayer();
    }
    return () => {
      releasePlayer();
    };
  }, [visible, releasePlayer]);

  // 表示対象のアイテム (「もう一度」で送ったものは後回し)
  const currentItem = useMemo(() => {
    if (dueItems.length === 0) return null;
    const nonDeferred = dueItems.find(
      (it) => !deferredKeys.includes(`${it.lessonId}:${it.sentenceIndex}`)
    );
    if (nonDeferred) return nonDeferred;
    for (const k of deferredKeys) {
      const match = dueItems.find((it) => `${it.lessonId}:${it.sentenceIndex}` === k);
      if (match) return match;
    }
    return dueItems[0];
  }, [dueItems, deferredKeys]);

  const handleTogglePlay = useCallback(async () => {
    if (!currentItem) return;
    if (isPlaying) {
      stopPlayback();
      return;
    }
    stopPlayback();
    const token = playTokenRef.current;
    setIsPlaying(true);

    try {
      await setAudioModeAsync({ playsInSilentMode: true });
      if (playTokenRef.current !== token) return;

      const player = createAudioPlayer(currentItem.audio);
      if (playTokenRef.current !== token) {
        try {
          player.release();
        } catch {}
        return;
      }
      playerRef.current = player;

      await player.seekTo(
        currentItem.sentence.startSec,
        SEEK_TOLERANCE_MILLIS,
        SEEK_TOLERANCE_MILLIS
      );
      if (playTokenRef.current !== token) return;

      let stopped = false;
      subRef.current = player.addListener('playbackStatusUpdate', (st) => {
        if (playTokenRef.current !== token || stopped) return;
        if (st.didJustFinish || st.currentTime >= currentItem.sentence.endSec) {
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
  }, [currentItem, isPlaying, stopPlayback]);

  const handleOutcome = (remembered: boolean) => {
    if (!currentItem) return;
    stopPlayback();
    const key = `${currentItem.lessonId}:${currentItem.sentenceIndex}`;
    const willGraduate = remembered && currentItem.reviewStage + 1 >= GRADUATION_STAGE;
    setStatusNotice(
      willGraduate
        ? '✓ 3回連続クリアで定着・卒業しました！'
        : remembered
          ? '✓ 次回の復習間隔を伸ばしました'
          : 'もう一度キューの後ろに追加しました'
    );
    if (!remembered) {
      setDeferredKeys((prev) => [...prev.filter((k) => k !== key), key]);
    } else {
      setDeferredKeys((prev) => prev.filter((k) => k !== key));
    }
    setShowText(false);
    onRecordOutcome(currentItem.lessonId, currentItem.sentenceIndex, remembered);
  };

  const handleClose = () => {
    stopPlayback();
    setShowText(false);
    setDeferredKeys([]);
    setStatusNotice(null);
    onClose();
  };

  return (
    <BottomSheet visible={visible} title="今日の復習" onClose={handleClose}>
      <View style={styles.summaryBar}>
        <ThemedText variant="caption" color="muted">
          残り {dueItems.length} 件 ・ 卒業 {graduatedCount} 件
        </ThemedText>
        {statusNotice ? (
          <ThemedText variant="caption" style={{ color: colors.success, fontWeight: '700' }}>
            {statusNotice}
          </ThemedText>
        ) : null}
      </View>

      {currentItem ? (
        <>
          <View
            style={[
              styles.card,
              { backgroundColor: colors.secondarySurface, borderColor: colors.border },
            ]}
          >
            <View style={styles.metaRow}>
              <ThemedText variant="caption" color="primary" style={styles.lessonTitle}>
                {currentItem.titleJa}
              </ThemedText>
              <View style={styles.stageDots} accessible accessibilityLabel={`定着度 ${currentItem.reviewStage} / ${GRADUATION_STAGE}`}>
                {Array.from({ length: GRADUATION_STAGE }).map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.dot,
                      {
                        backgroundColor:
                          i < currentItem.reviewStage ? colors.success : colors.border,
                      },
                    ]}
                  />
                ))}
              </View>
            </View>

            <Pressable
              onPress={() => void handleTogglePlay()}
              style={[
                styles.playButton,
                { backgroundColor: colors.surface, borderColor: colors.primary },
              ]}
              accessibilityRole="button"
              accessibilityLabel={isPlaying ? '音声を停止' : '音声を再生する'}
            >
              <SymbolView
                name={isPlaying ? 'stop.fill' : 'play.fill'}
                size={14}
                tintColor={colors.primary}
                fallback={
                  <ThemedText color="primary" style={{ fontWeight: '700' }}>
                    {isPlaying ? '■' : '▶'}
                  </ThemedText>
                }
              />
              <ThemedText color="primary" style={styles.playText}>
                {isPlaying ? '再生を停止' : '音声を聞く'}
              </ThemedText>
            </Pressable>

            {showText ? (
              <View style={styles.answerBox}>
                <ThemedText variant="heading">{currentItem.sentence.text}</ThemedText>
                <ThemedText variant="caption" color="muted">
                  {currentItem.sentence.translationJa}
                </ThemedText>
                {currentItem.uniqueTypes.length > 0 ? (
                  <View style={styles.badgeRow}>
                    {currentItem.uniqueTypes.map((type) => {
                      const c = getLinkingColor(type, scheme);
                      return (
                        <View
                          key={type}
                          style={[styles.typeBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}
                        >
                          <ThemedText variant="caption" style={[styles.typeBadgeText, { color: c }]}>
                            {LINKING_SYMBOLS[type]} {LINKING_LABELS[type]}
                          </ThemedText>
                        </View>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            ) : (
              <Pressable
                onPress={() => setShowText(true)}
                style={[styles.revealBox, { backgroundColor: colors.surface, borderColor: colors.border }]}
                accessibilityRole="button"
                accessibilityLabel="英文と解説を確認する"
              >
                <ThemedText variant="caption" color="primary" style={styles.revealText}>
                  まず音だけで聞き取り、タップで英文を確認
                </ThemedText>
              </Pressable>
            )}

            <Pressable
              onPress={() => {
                const lid = currentItem.lessonId;
                const idx = currentItem.sentenceIndex;
                handleClose();
                onPracticeSpeak(lid, idx);
              }}
              hitSlop={{ top: 8, bottom: 8 }}
              accessibilityRole="button"
              style={styles.speakLink}
            >
              <ThemedText variant="caption" color="primary" style={styles.speakLinkText}>
                この文をシャドーイングで話す ›
              </ThemedText>
            </Pressable>
          </View>

          <View style={styles.decisionRow}>
            <Pressable
              onPress={() => handleOutcome(false)}
              style={[styles.secondaryBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
              accessibilityRole="button"
            >
              <ThemedText style={styles.secondaryBtnText}>もう一度</ThemedText>
            </Pressable>
            <Pressable
              onPress={() => handleOutcome(true)}
              style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
              accessibilityRole="button"
            >
              <ThemedText style={{ color: colors.primaryText, fontWeight: '700' }}>
                聞き取れた ✓
              </ThemedText>
            </Pressable>
          </View>
        </>
      ) : (
        <View
          style={[
            styles.doneCard,
            { backgroundColor: colors.secondarySurface, borderColor: colors.border },
          ]}
        >
          <ThemedText variant="heading">✓ 今日の復習は完了しました</ThemedText>
          <ThemedText variant="caption" color="muted">
            これまでに {graduatedCount} 件の苦手フレーズが定着・卒業しています。
          </ThemedText>
          <Pressable
            onPress={handleClose}
            style={[styles.donePrimaryBtn, { backgroundColor: colors.primary }]}
            accessibilityRole="button"
          >
            <ThemedText style={{ color: colors.primaryText, fontWeight: '700' }}>
              閉じる
            </ThemedText>
          </Pressable>
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  summaryBar: {
    gap: 4,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  lessonTitle: {
    fontWeight: '700',
    flexShrink: 1,
  },
  stageDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  playButton: {
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  playText: {
    fontWeight: '700',
  },
  revealBox: {
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    paddingVertical: 20,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  revealText: {
    fontWeight: '600',
  },
  answerBox: {
    gap: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  typeBadge: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  typeBadgeText: {
    fontWeight: '600',
  },
  speakLink: {
    alignSelf: 'flex-start',
    paddingVertical: 2,
  },
  speakLinkText: {
    fontWeight: '600',
  },
  decisionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontWeight: '700',
  },
  primaryBtn: {
    flex: 1.4,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 10,
    alignItems: 'center',
  },
  donePrimaryBtn: {
    alignSelf: 'stretch',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
});
