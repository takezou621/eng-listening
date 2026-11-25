import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import {
  createAudioPlayer,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  type AudioPlayer,
} from 'expo-audio';
import { File } from 'expo-file-system';
import { SymbolView, type SFSymbol } from 'expo-symbols';

import { BottomSheet } from '@/components/BottomSheet';
import { Chip } from '@/components/Chip';
import { ThemedText } from '@/components/ThemedText';
import { SEEK_TOLERANCE_MILLIS, STATUS_UPDATE_INTERVAL_MILLIS } from '@/config/appConfig';
import { logEvent } from '@/features/analytics/analyticsStore';
import {
  LINKING_LABELS,
  LINKING_SYMBOLS,
  getLinkingColor,
  getLinkingTextDecoration,
  wordLinkMap,
} from '@/features/lesson/linkingViz';
import type { LessonLinkingNote, LessonSentence } from '@/features/lesson/types';
import { useTheme } from '@/theme/AppThemeProvider';

export interface PhrasePlaylistItem {
  lessonId: string;
  titleJa: string;
  audio: number;
  sentence: LessonSentence;
  uniqueTypes: LessonLinkingNote['type'][];
}

type PlaylistMode = 'karaoke' | 'shadowing';

/** 文末で再生を止めてから次の文へ進むまでの間隔 (ms) */
const AUTO_ADVANCE_DELAY_MS = 600;

const PLAYBACK_AUDIO_MODE = { allowsRecording: false, playsInSilentMode: true };
const RECORDING_AUDIO_MODE = { allowsRecording: true, playsInSilentMode: true };

interface ButtonIcon {
  name: SFSymbol;
  fallback: string;
}

const PLAY_ICON: ButtonIcon = { name: 'play.fill', fallback: '▶' };
const STOP_ICON: ButtonIcon = { name: 'stop.fill', fallback: '■' };
const MIC_ICON: ButtonIcon = { name: 'mic.fill', fallback: '●' };

/** 自分の録音の一時ファイルを破棄する (録音は端末内でだけ使い、使い終えたら消す) */
function deleteRecordingFile(uri: string | null): void {
  if (uri && uri.startsWith('file://')) {
    try {
      new File(uri).delete();
    } catch {}
  }
}

/** 操作列とカード内で使うボタン。青フィル (primary) と枠線の 2 種類のみ */
function PlaylistButton({
  label,
  onPress,
  primary = false,
  disabled = false,
  icon,
  accessibilityLabel,
  style,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
  icon?: ButtonIcon;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const tint = primary ? colors.primaryText : colors.primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      style={[
        styles.button,
        {
          backgroundColor: primary ? colors.primary : colors.surface,
          borderColor: colors.primary,
        },
        disabled && styles.buttonDisabled,
        style,
      ]}
    >
      {icon ? (
        <SymbolView
          name={icon.name}
          size={14}
          tintColor={tint}
          fallback={
            <ThemedText style={{ color: tint, fontSize: 12, fontWeight: '700' }}>
              {icon.fallback}
            </ThemedText>
          }
        />
      ) : null}
      <ThemedText numberOfLines={1} adjustsFontSizeToFit style={[styles.buttonText, { color: tint }]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

/** 英文 1 行。音変化に属する単語は色と装飾を付け、カラオケ風表示のときだけ読み上げ位置を強調する */
function PlaylistEnglishLine({
  sentence,
  activeWordIndex,
  highlight,
}: {
  sentence: LessonSentence;
  /** 強調中の単語。-1 はどの単語も強調していない状態 */
  activeWordIndex: number;
  /** false のときはハイライトせず、全文を既読の色で出す (シャドーイング) */
  highlight: boolean;
}) {
  const { scheme, colors } = useTheme();
  const linkMap = useMemo(() => wordLinkMap(sentence), [sentence]);

  return (
    <View accessible accessibilityLabel={sentence.text} style={styles.englishLine}>
      {sentence.words.map((word, wordIndex) => {
        const isActive = highlight && wordIndex === activeWordIndex;
        const isPast = !highlight || wordIndex < activeWordIndex;
        const noteIndex = linkMap[wordIndex];
        const note = noteIndex == null ? undefined : sentence.linking[noteIndex];
        const linkColor = note ? getLinkingColor(note.type, scheme) : null;
        const textColor = isActive
          ? colors.primary
          : (linkColor ?? (isPast ? colors.text : colors.textMuted));
        return (
          <ThemedText
            key={wordIndex}
            style={[
              styles.englishWord,
              { color: textColor },
              isActive && styles.englishWordActive,
              linkColor !== null && !isActive && styles.englishWordLinked,
              note
                ? [getLinkingTextDecoration(note.type, scheme), { textDecorationColor: textColor }]
                : null,
            ]}
          >
            {word.text}
          </ThemedText>
        );
      })}
    </View>
  );
}

/**
 * 苦手フレーズの連続復習プレイリスト (Issue #95)。
 * 受け取った順序で 1 フレーズずつ進める。復習ステージ (SRS) は更新しない。
 * モデル音声と自分の録音は、文やモードの切替・シートを閉じる・アンマウントのすべてで解放する。
 */
export function PhrasePlaylistSheet({
  visible,
  items,
  soundChangeType,
  onClose,
}: {
  visible: boolean;
  /** 開いた時点のプレイリスト (開いている間は変わらない) */
  items: PhrasePlaylistItem[];
  /** タイプ別フィルタ中のときはそのタイプ、それ以外は null */
  soundChangeType: LessonLinkingNote['type'] | null;
  onClose: () => void;
}) {
  const { scheme, colors } = useTheme();
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState<PlaylistMode>('karaoke');
  const [activeWordIndex, setActiveWordIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [micDenied, setMicDenied] = useState(false);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [isUserPlaying, setIsUserPlaying] = useState(false);
  const [playedCount, setPlayedCount] = useState(0);
  // 聞き終えたフレーズ。遅延初期化で作った固定の Set に追記する
  const [playedIndexes] = useState(() => new Set<number>());

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  // モデル音声。playTokenRef の世代を進めることで、競合した古いプレイヤーは必ず自分を解放する
  const modelPlayerRef = useRef<AudioPlayer | null>(null);
  const modelSubRef = useRef<{ remove: () => void } | null>(null);
  const playTokenRef = useRef(0);
  // 自分の録音の再生
  const userPlayerRef = useRef<AudioPlayer | null>(null);
  const userSubRef = useRef<{ remove: () => void } | null>(null);
  const userPlayTokenRef = useRef(0);
  const autoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 録音の開始〜停止の非同期処理を無効化するための世代
  const recordTokenRef = useRef(0);
  const isRecordingRef = useRef(false);
  const recordedUriRef = useRef<string | null>(null);
  const finishedLoggedRef = useRef(false);

  // 文・モードが変わったら表示状態を初期化する (前回値との比較で render 中に調整するパターン)。
  // 再生と録音そのものは effect の後始末で止める
  const [prevStep, setPrevStep] = useState({ index, mode });
  if (prevStep.index !== index || prevStep.mode !== mode) {
    setPrevStep({ index, mode });
    setIsPlaying(false);
    setActiveWordIndex(-1);
    setIsUserPlaying(false);
    setIsRecording(false);
    // 前の文・前モードの録音は使い回さない (ファイルは effect の後始末で破棄)
    setRecordedUri(null);
    setMicDenied(false);
  }

  const clearAutoAdvanceTimer = useCallback(() => {
    if (autoAdvanceTimerRef.current !== null) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
  }, []);

  /** モデル音声を止めて解放する。表示状態は変えない (呼び出し側で整える) */
  const releaseModelPlayer = useCallback(() => {
    playTokenRef.current += 1;
    modelSubRef.current?.remove();
    modelSubRef.current = null;
    const player = modelPlayerRef.current;
    modelPlayerRef.current = null;
    if (player) {
      try {
        player.pause();
      } catch {}
      try {
        player.release();
      } catch {}
    }
  }, []);

  const releaseUserPlayer = useCallback(() => {
    userPlayTokenRef.current += 1;
    userSubRef.current?.remove();
    userSubRef.current = null;
    const player = userPlayerRef.current;
    userPlayerRef.current = null;
    if (player) {
      try {
        player.pause();
      } catch {}
      try {
        player.release();
      } catch {}
    }
  }, []);

  /** 自分の録音の再生を止め、一時ファイルを破棄する */
  const clearRecording = useCallback(() => {
    releaseUserPlayer();
    deleteRecordingFile(recordedUriRef.current);
    recordedUriRef.current = null;
  }, [releaseUserPlayer]);

  /** 録音中なら中断する。中途の録音は採用せず、ファイルごと破棄する */
  const abortRecording = useCallback(() => {
    recordTokenRef.current += 1;
    if (isRecordingRef.current) {
      isRecordingRef.current = false;
      recorder
        .stop()
        .catch(() => {})
        .then(() => {
          // 停止を待っている間に新しい録音が始まっていたら手を引く
          // (閉じる・後始末による再呼び出しでは、削除と音声モードの復帰は必ず行う)
          if (isRecordingRef.current) return;
          deleteRecordingFile(recorder.uri);
          void setAudioModeAsync(PLAYBACK_AUDIO_MODE).catch(() => {});
        });
    }
  }, [recorder]);

  /** 再生・自動進行・録音をすべて止める (文・モードの切替、シートを閉じる、アンマウントで呼ぶ) */
  const teardownAll = useCallback(() => {
    clearAutoAdvanceTimer();
    releaseModelPlayer();
    clearRecording();
    abortRecording();
  }, [clearAutoAdvanceTimer, releaseModelPlayer, clearRecording, abortRecording]);

  const stopModelPlayback = useCallback(() => {
    clearAutoAdvanceTimer();
    releaseModelPlayer();
    setIsPlaying(false);
    setActiveWordIndex(-1);
  }, [clearAutoAdvanceTimer, releaseModelPlayer]);

  const markPlayed = useCallback(
    (itemIndex: number) => {
      if (playedIndexes.has(itemIndex)) return;
      playedIndexes.add(itemIndex);
      setPlayedCount(playedIndexes.size);
    },
    [playedIndexes]
  );

  const logFinished = useCallback(
    (completed: boolean) => {
      if (finishedLoggedRef.current || items.length === 0) return;
      finishedLoggedRef.current = true;
      logEvent('weak_phrase_playlist_finished', {
        itemCount: items.length,
        playedCount: playedIndexes.size,
        completed,
      });
    },
    [items, playedIndexes]
  );

  const goTo = useCallback(
    (next: number) => {
      const target = Math.max(0, Math.min(next, items.length));
      if (target >= items.length) logFinished(true);
      clearRecording();
      setRecordedUri(null);
      setMicDenied(false);
      setIndex(target);
    },
    [items.length, logFinished, clearRecording]
  );

  const handleSentenceEnd = useCallback(
    (itemIndex: number) => {
      releaseModelPlayer();
      setIsPlaying(false);
      markPlayed(itemIndex);
      autoAdvanceTimerRef.current = setTimeout(() => {
        autoAdvanceTimerRef.current = null;
        goTo(itemIndex + 1);
      }, AUTO_ADVANCE_DELAY_MS);
    },
    [releaseModelPlayer, markPlayed, goTo]
  );

  /**
   * モデル音声を文の先頭から再生する。
   * effect からも呼ぶため、この関数本体では表示状態を変えない (再生状況は通知で反映する)
   */
  const startModelPlayback = useCallback(
    async (item: PhrasePlaylistItem, itemIndex: number) => {
      // 前の再生と予約済みの自動進行を止めてから、新しいプレイヤーを用意する
      clearAutoAdvanceTimer();
      releaseModelPlayer();
      const token = playTokenRef.current;

      try {
        await setAudioModeAsync(PLAYBACK_AUDIO_MODE);
        if (playTokenRef.current !== token) return;

        const player = createAudioPlayer(item.audio, {
          updateInterval: STATUS_UPDATE_INTERVAL_MILLIS,
        });
        if (playTokenRef.current !== token) {
          try {
            player.release();
          } catch {}
          return;
        }
        modelPlayerRef.current = player;

        await player.seekTo(
          item.sentence.startSec,
          SEEK_TOLERANCE_MILLIS,
          SEEK_TOLERANCE_MILLIS
        );
        if (playTokenRef.current !== token) return;

        const words = item.sentence.words;
        const endSec = item.sentence.endSec;
        let started = false;
        let ended = false;
        modelSubRef.current = player.addListener('playbackStatusUpdate', (status) => {
          if (playTokenRef.current !== token || ended) return;
          if (status.didJustFinish || status.currentTime >= endSec) {
            ended = true;
            handleSentenceEnd(itemIndex);
            return;
          }
          // 再生中の通知が一度来たあとの停止は、電話などによる中断。自動進行も止まる
          if (status.playing) {
            started = true;
            setIsPlaying(true);
          } else if (started) {
            setIsPlaying(false);
          }
          let active = -1;
          for (let i = 0; i < words.length; i++) {
            if (status.currentTime >= words[i].startSec && status.currentTime < words[i].endSec) {
              active = i;
              break;
            }
          }
          setActiveWordIndex(active);
        });
        player.play();
      } catch {
        // 読み込めなかった場合は何も鳴らさない (表示は「再生」のまま)
        releaseModelPlayer();
      }
    },
    [clearAutoAdvanceTimer, releaseModelPlayer, handleSentenceEnd]
  );

  const playUserRecording = useCallback(
    (uri: string) => {
      releaseUserPlayer();
      const token = userPlayTokenRef.current;
      const player = createAudioPlayer(uri);
      userPlayerRef.current = player;
      let finished = false;
      userSubRef.current = player.addListener('playbackStatusUpdate', (status) => {
        if (userPlayTokenRef.current !== token || finished) return;
        if (status.didJustFinish) {
          finished = true;
          releaseUserPlayer();
          setIsUserPlaying(false);
        }
      });
      setIsUserPlaying(true);
      player.play();
    },
    [releaseUserPlayer]
  );

  const startRecording = useCallback(async () => {
    if (isRecordingRef.current) return;
    clearRecording();
    setRecordedUri(null);
    const token = ++recordTokenRef.current;

    try {
      const permission = await requestRecordingPermissionsAsync();
      if (recordTokenRef.current !== token) return;
      if (!permission.granted) {
        setMicDenied(true);
        return;
      }
      setMicDenied(false);
      await setAudioModeAsync(RECORDING_AUDIO_MODE);
      if (recordTokenRef.current !== token) {
        // 待っている間に閉じる・文送りが入った。録音は始めず、音声モードだけ戻す
        void setAudioModeAsync(PLAYBACK_AUDIO_MODE).catch(() => {});
        return;
      }
      recorder.record();
      isRecordingRef.current = true;
      setIsRecording(true);
    } catch {
      if (recordTokenRef.current === token) {
        void setAudioModeAsync(PLAYBACK_AUDIO_MODE).catch(() => {});
      }
    }
  }, [clearRecording, recorder]);

  const stopRecording = useCallback(
    async (item: PhrasePlaylistItem, itemIndex: number) => {
      if (!isRecordingRef.current) return;
      isRecordingRef.current = false;
      setIsRecording(false);
      const token = recordTokenRef.current;
      let uri: string | null = null;
      try {
        await recorder.stop();
        uri = recorder.uri;
      } catch {}
      void setAudioModeAsync(PLAYBACK_AUDIO_MODE).catch(() => {});
      // 停止を待っている間に閉じる・文送りが入ったら、この録音は採用しない
      if (recordTokenRef.current !== token) {
        deleteRecordingFile(uri);
        return;
      }
      if (!uri) return;
      recordedUriRef.current = uri;
      setRecordedUri(uri);
      markPlayed(itemIndex);
      logEvent('shadowing_recorded', { lessonId: item.lessonId });
      playUserRecording(uri);
    },
    [recorder, markPlayed, playUserRecording]
  );

  const endSession = useCallback(() => {
    teardownAll();
    logFinished(false);
  }, [teardownAll, logFinished]);

  // 文・モードが変わるたびに、前の文の資源をすべて解放する (アンマウント時も同じ)
  useEffect(() => {
    return () => {
      teardownAll();
    };
  }, [teardownAll]);

  // 文・モードが切り替わった瞬間に前の文の再生・録音を止める (シャドーイングへ切り替えた
  // ときにモデル音声が鳴り続けないようにする。自動再生の effect はこの後段で走る)
  useEffect(() => {
    teardownAll();
  }, [index, mode, teardownAll]);

  // カラオケ風表示で文に入ったら、モデル音声を自動再生する
  useEffect(() => {
    if (!visible || mode !== 'karaoke') return;
    const currentItem = items[index];
    if (currentItem) void startModelPlayback(currentItem, index);
  }, [visible, mode, items, index, startModelPlayback]);

  // 開いたときに開始を記録する。閉じる・非表示・アンマウント時は後始末して終了を記録する
  useEffect(() => {
    if (visible) {
      finishedLoggedRef.current = false;
      if (items.length > 0) {
        logEvent('weak_phrase_playlist_started', {
          itemCount: items.length,
          ...(soundChangeType ? { soundChangeType } : {}),
        });
      }
    }
    return () => {
      endSession();
    };
  }, [visible, items, soundChangeType, endSession]);

  const handleClose = () => {
    endSession();
    onClose();
  };

  const handleRecordPress = (item: PhrasePlaylistItem, itemIndex: number) => {
    if (isRecordingRef.current) void stopRecording(item, itemIndex);
    else void startRecording();
  };

  /** 「聞き比べる」: 自分の録音を再生する。再生中は停止に切り替わる */
  const handleComparePress = () => {
    if (isUserPlaying) {
      releaseUserPlayer();
      setIsUserPlaying(false);
    } else if (recordedUri) {
      playUserRecording(recordedUri);
    }
  };

  const currentItem = index < items.length ? items[index] : undefined;
  // シャドーイングで録音ができるまでは「録音して話す」をプライマリにし、プライマリは常に 1 つ (P1)
  const recordIsPrimary = mode === 'shadowing' && recordedUri === null;

  return (
    <BottomSheet visible={visible} title="連続復習" onClose={handleClose}>
      {currentItem ? (
        <>
          <ThemedText
            variant="caption"
            color="muted"
            accessibilityLabel={`${index + 1} 件目、全 ${items.length} 件`}
          >
            {index + 1} / {items.length}
          </ThemedText>

          <View
            style={[
              styles.card,
              { backgroundColor: colors.secondarySurface, borderColor: colors.border },
            ]}
          >
            <ThemedText
              variant="caption"
              color="primary"
              numberOfLines={1}
              style={styles.lessonTitle}
            >
              {currentItem.titleJa}
            </ThemedText>
            <PlaylistEnglishLine
              sentence={currentItem.sentence}
              activeWordIndex={activeWordIndex}
              highlight={mode === 'karaoke'}
            />
            <ThemedText variant="caption" color="muted">
              {currentItem.sentence.translationJa}
            </ThemedText>
            {currentItem.uniqueTypes.length > 0 ? (
              <View style={styles.badgeRow}>
                {currentItem.uniqueTypes.map((type) => (
                  <View
                    key={type}
                    style={[
                      styles.typeBadge,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                    ]}
                  >
                    <ThemedText
                      variant="caption"
                      style={[styles.typeBadgeText, { color: getLinkingColor(type, scheme) }]}
                    >
                      {LINKING_SYMBOLS[type]} {LINKING_LABELS[type]}
                    </ThemedText>
                  </View>
                ))}
              </View>
            ) : null}

            {mode === 'shadowing' ? (
              <>
                {recordedUri ? (
                  <PlaylistButton
                    label={isUserPlaying ? '停止' : '聞き比べる'}
                    icon={isUserPlaying ? STOP_ICON : PLAY_ICON}
                    onPress={handleComparePress}
                    style={styles.cardButton}
                  />
                ) : (
                  <PlaylistButton
                    label={isRecording ? '録音中… タップで停止' : '録音して話す'}
                    primary
                    icon={isRecording ? STOP_ICON : MIC_ICON}
                    onPress={() => handleRecordPress(currentItem, index)}
                    style={styles.cardButton}
                  />
                )}
                {micDenied ? (
                  <ThemedText variant="caption" style={{ color: colors.danger }}>
                    設定でマイクを許可すると録音できます
                  </ThemedText>
                ) : null}
              </>
            ) : null}
          </View>

          <View style={styles.modeRow}>
            <Chip
              label="カラオケ風表示"
              variant="outlined"
              active={mode === 'karaoke'}
              onPress={() => setMode('karaoke')}
            />
            <Chip
              label="シャドーイング"
              variant="outlined"
              active={mode === 'shadowing'}
              onPress={() => setMode('shadowing')}
            />
          </View>

          <View style={styles.actionRow}>
            <PlaylistButton
              label="前へ"
              disabled={index === 0}
              onPress={() => goTo(index - 1)}
              style={styles.navButton}
            />
            {mode === 'karaoke' ? (
              <PlaylistButton
                label={isPlaying ? '停止' : '再生'}
                accessibilityLabel={isPlaying ? '音声を停止' : '音声を再生する'}
                icon={isPlaying ? STOP_ICON : PLAY_ICON}
                onPress={() => {
                  if (isPlaying) {
                    // 停止したら自動進行も止める
                    stopModelPlayback();
                  } else {
                    setActiveWordIndex(-1);
                    void startModelPlayback(currentItem, index);
                  }
                }}
                style={styles.middleButton}
              />
            ) : recordedUri ? (
              <PlaylistButton
                label="もう一度録音"
                onPress={() => void startRecording()}
                style={styles.middleButton}
              />
            ) : null}
            <PlaylistButton
              label="次へ"
              primary={!recordIsPrimary}
              onPress={() => goTo(index + 1)}
              style={styles.nextButton}
            />
          </View>
        </>
      ) : (
        <View
          style={[
            styles.doneCard,
            { backgroundColor: colors.secondarySurface, borderColor: colors.border },
          ]}
        >
          <ThemedText variant="heading">✓ 連続復習が完了しました</ThemedText>
          <ThemedText variant="caption" color="muted">
            {playedCount} 件を聞きました
          </ThemedText>
          <PlaylistButton label="閉じる" primary onPress={handleClose} style={styles.doneButton} />
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  englishLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    columnGap: 6,
    rowGap: 6,
  },
  englishWord: {
    fontSize: 20,
    lineHeight: 30,
  },
  englishWordActive: {
    fontWeight: '700',
  },
  englishWordLinked: {
    fontWeight: '600',
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  lessonTitle: {
    fontWeight: '600',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
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
  cardButton: {
    minHeight: 48,
    marginTop: 4,
  },
  modeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  navButton: {
    flex: 0.8,
  },
  middleButton: {
    flex: 1.2,
  },
  nextButton: {
    flex: 1.1,
  },
  doneCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 10,
    alignItems: 'center',
  },
  doneButton: {
    alignSelf: 'stretch',
    minHeight: 48,
    marginTop: 8,
  },
});
