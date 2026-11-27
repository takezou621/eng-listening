import { Fragment, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import {
  createAudioPlayer,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  type AudioPlayer,
  type RecordingStatus,
} from 'expo-audio';
import { deleteAsync } from 'expo-file-system';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { Chip } from '@/components/Chip';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import {
  PITCH_CORRECTION_QUALITY,
  PLAYBACK_RATES,
  SEEK_TOLERANCE_MILLIS,
  STATUS_UPDATE_INTERVAL_MILLIS,
  type PlaybackRate,
} from '@/config/appConfig';
import { logEvent } from '@/features/analytics/analyticsStore';
import {
  claimWatchPlayback,
  pushWatchPlayback,
  registerWatchCommandHandler,
} from '@/features/watch/watchSync';
import { initBillingAsync, useEntitlement } from '@/features/billing/billingStore';
import { OvercomingGuideBar } from '@/features/learning/components/OvercomingGuideBar';
import {
  recordMasteryLessonCompleted,
  recordMasteryLinkingNoteOpened,
  recordMasteryOvercomingCompleted,
  recordMasteryQuiz,
  recordMasteryShadowing,
} from '@/features/learning/masteryStore';
import {
  buildLessonQuiz,
  type LessonQuizQuestion,
} from '@/features/learning/lessonQuiz';
import {
  getTargetSentenceIndicesForType,
  parseFocusType,
  pickNextOvercomingLesson,
  type OvercomingStepKey,
} from '@/features/learning/overcomingPath';
import {
  CompletionSummaryModal,
  LegendSheet,
  LinkingNoteSheet,
  PlaybackToolsSheet,
} from '@/features/lesson/components/LessonSheets';
import { LessonQuizModal } from '@/features/lesson/components/LessonQuizModal';
import {
  ShadowingFooterBar,
  ShadowingStage,
} from '@/features/lesson/components/ShadowingStage';
import {
  LINKING_LABELS,
  LINKING_SYMBOLS,
  getLinkingColor,
  getLinkingTextDecoration,
  wordLinkMap,
} from '@/features/lesson/linkingViz';
import { getLessonKeyPhrase } from '@/features/learning/curriculum';
import { getLessonBundle, getLessonList, type LessonBundle } from '@/features/lesson/registry';
import type { LessonLinkingNote, LessonSentence, LessonWord } from '@/features/lesson/types';
import { useUserData } from '@/features/library/userStore';
import {
  getPlayerPrefs,
  setPlayerPrefsAutoRecord,
  setPlayerPrefsLessonMode,
  setPlayerPrefsRate,
  togglePlayerPrefsChunkJa,
  type LessonMode,
} from '@/features/player/playerPrefs';
import {
  addShadowingCount,
  getShadowingCounts,
} from '@/features/player/shadowingStore';
import { formatTime } from '@/features/player/shared';
import {
  addShadowingRecord,
  addStudySeconds,
  computeDailyGoalStatus,
  computeStreak,
  computeTodaySeconds,
  localDateStr,
  markLessonCompleted,
  useProgressData,
} from '@/features/progress/progressStore';
import {
  clearLessonResumePosition,
  saveLessonResumePosition,
} from '@/features/player/lessonResumeStore';
import { useTheme } from '@/theme/AppThemeProvider';

const LESSON_MODES: readonly { key: LessonMode; label: string }[] = [
  { key: 'listen', label: '聞く' },
  { key: 'read', label: '読む' },
  { key: 'speak', label: '話す' },
  { key: 'script', label: 'スクリプト' },
];

/** チャンクごとの単語インデックス範囲 */
function chunkWordRanges(sentence: LessonSentence): { from: number; to: number }[] {
  const ranges: { from: number; to: number }[] = [];
  let ptr = 0;
  for (const chunk of sentence.chunks) {
    const n = chunk.text.split(/\s+/).filter((t) => t.length > 0).length;
    ranges.push({ from: ptr, to: Math.min(ptr + n, sentence.words.length) });
    ptr += n;
  }
  return ranges;
}

function TransportIcon({
  name,
  fallback,
  color,
  size = 15,
}: {
  name: SFSymbol;
  fallback: string;
  color: string;
  size?: number;
}) {
  return (
    <SymbolView
      name={name}
      size={size}
      tintColor={color}
      type="monochrome"
      resizeMode="scaleAspectFit"
      fallback={<ThemedText style={{ color, fontSize: size }}>{fallback}</ThemedText>}
    />
  );
}

/**
 * 下部固定の再生バー (1段構成、P1/P3 準拠)。
 * 親の React Compiler メモ化分析と干渉しないよう独立コンポーネントにしている。
 */
function TransportBar({
  progress,
  currentTime,
  duration,
  playing,
  sentenceIndex,
  sentenceCount,
  firstStartSec,
  rate,
  abActive,
  onOpenTools,
  onPrev,
  onRewind3s,
  onNext,
  onTogglePlay,
  onSeek,
}: {
  progress: number;
  currentTime: number;
  duration: number;
  playing: boolean;
  sentenceIndex: number;
  sentenceCount: number;
  firstStartSec: number;
  rate: PlaybackRate;
  abActive: boolean;
  onOpenTools: () => void;
  onPrev: () => void;
  onRewind3s: () => void;
  onNext: () => void;
  onTogglePlay: () => void;
  onSeek: (seconds: number) => void;
}) {
  const { colors } = useTheme();
  const trackWidthRef = useRef(0);
  const canPrev = !(sentenceIndex === 0 && currentTime <= firstStartSec + 0.3);
  const canRewind = currentTime > 0.1;
  const canNext = sentenceIndex < sentenceCount - 1;
  const toolsModified = rate !== 1.0 || abActive;
  const toolsLabel = abActive ? 'AB' : `${rate}x`;

  return (
    <View
      style={[
        styles.transportBar,
        { backgroundColor: colors.surface, borderTopColor: colors.border },
      ]}
    >
      <View style={styles.seekRow}>
        <ThemedText variant="caption" color="muted" style={styles.seekTime}>
          {formatTime(currentTime)}
        </ThemedText>
        <Pressable
          hitSlop={{ top: 16, bottom: 6 }}
          style={styles.seekTrackTouch}
          onLayout={(e) => {
            trackWidthRef.current = e.nativeEvent.layout.width;
          }}
          onPress={(e) => {
            const width = trackWidthRef.current;
            if (!width || !duration) return;
            const ratio = Math.min(Math.max(e.nativeEvent.locationX / width, 0), 1);
            onSeek(ratio * duration);
          }}
          accessibilityRole="adjustable"
          accessibilityLabel="再生位置"
          accessibilityValue={{
            min: 0,
            max: Math.round(duration),
            now: Math.round(currentTime),
            text: `${formatTime(currentTime)} / ${formatTime(duration)}`,
          }}
          accessibilityActions={[
            { name: 'increment', label: '10秒進める' },
            { name: 'decrement', label: '10秒戻す' },
          ]}
          onAccessibilityAction={(e) => {
            if (!duration) return;
            if (e.nativeEvent.actionName === 'increment') {
              onSeek(Math.min(currentTime + 10, duration));
            } else if (e.nativeEvent.actionName === 'decrement') {
              onSeek(Math.max(currentTime - 10, 0));
            }
          }}
        >
          <View style={[styles.seekTrack, { backgroundColor: colors.border }]}>
            <View
              style={[
                styles.seekFill,
                { backgroundColor: colors.primary, width: `${progress * 100}%` },
              ]}
            />
          </View>
        </Pressable>
        <ThemedText variant="caption" color="muted" style={styles.seekTime}>
          {formatTime(duration)}
        </ThemedText>
      </View>
      <View style={styles.transportRow}>
        <Pressable
          style={[
            styles.transportTools,
            {
              borderColor: toolsModified ? colors.primary : colors.border,
              backgroundColor: toolsModified ? colors.secondarySurface : colors.surface,
            },
          ]}
          onPress={onOpenTools}
          accessibilityRole="button"
          accessibilityLabel={`再生速度と区間リピート（現在: ${toolsLabel}）`}
        >
          <ThemedText
            variant="caption"
            color={toolsModified ? 'primary' : 'default'}
            style={styles.transportToolsText}
          >
            {toolsLabel}
          </ThemedText>
        </Pressable>
        <Pressable
          style={[
            styles.transportSide,
            { backgroundColor: colors.secondarySurface },
            !canPrev ? styles.transportDisabled : null,
          ]}
          disabled={!canPrev}
          onPress={onPrev}
          accessibilityRole="button"
          accessibilityLabel="前の文"
        >
          <TransportIcon name="backward.end.fill" fallback="⏮" color={colors.text} />
        </Pressable>
        <Pressable
          style={[
            styles.transportRewind,
            { backgroundColor: colors.secondarySurface },
            !canRewind ? styles.transportDisabled : null,
          ]}
          disabled={!canRewind}
          onPress={onRewind3s}
          accessibilityRole="button"
          accessibilityLabel="3秒戻る"
        >
          <View style={styles.rewindInner}>
            <TransportIcon name="gobackward" fallback="↺" color={colors.text} size={13} />
            <ThemedText variant="caption" style={styles.rewindText}>
              3秒
            </ThemedText>
          </View>
        </Pressable>
        <Pressable
          style={[styles.transportPlay, { backgroundColor: colors.primary }]}
          onPress={onTogglePlay}
          accessibilityRole="button"
          accessibilityLabel={playing ? '一時停止' : '再生'}
        >
          <View style={styles.playInner}>
            <TransportIcon
              name={playing ? 'pause.fill' : 'play.fill'}
              fallback={playing ? '⏸' : '▶'}
              color={colors.primaryText}
              size={14}
            />
            <ThemedText style={{ color: colors.primaryText, fontWeight: '700' }}>
              {playing ? '一時停止' : '再生'}
            </ThemedText>
          </View>
        </Pressable>
        <Pressable
          style={[
            styles.transportSide,
            { backgroundColor: colors.secondarySurface },
            !canNext ? styles.transportDisabled : null,
          ]}
          disabled={!canNext}
          onPress={onNext}
          accessibilityRole="button"
          accessibilityLabel="次の文"
        >
          <TransportIcon name="forward.end.fill" fallback="⏭" color={colors.text} />
        </Pressable>
      </View>
      <ThemedText variant="caption" color="muted" style={styles.transportMeta}>
        文 {sentenceIndex + 1} / {sentenceCount}
      </ThemedText>
    </View>
  );
}

function LessonPlayerScreen({
  bundle,
  demoParam,
  initialSentenceIndex,
  initialMode,
  initialSheet,
  autorecordParam,
  autostudyParam,
  focusType,
}: {
  bundle: LessonBundle;
  demoParam: boolean;
  initialSentenceIndex: number | null;
  initialMode: LessonMode | null;
  initialSheet: 'linking' | 'tools' | 'legend' | null;
  autorecordParam: boolean;
  autostudyParam: boolean;
  focusType: LessonLinkingNote['type'] | null;
}) {
  const lesson = bundle.data;
  const sentences = lesson.sentences;
  const { scheme, colors } = useTheme();
  const { isSentenceWeak, toggleWeakSentence, recordWeakSentenceReview, weakSentences, dailyGoalMinutes } = useUserData();
  const router = useRouter();
  const progressDays = useProgressData();
  const { isPremium } = useEntitlement();

  const [showSummary, setShowSummary] = useState(false);
  const [summarySeconds, setSummarySeconds] = useState(0);
  const summaryShownRef = useRef(false);
  // lesson_completed (完了の記録・習熟度加算・計測) を初回完了時の 1 回だけ発火させる
  const lessonCompletedFiredRef = useRef(false);
  // 完了直後のミニ聞き分けクイズ (#103)。設問が作れないレッスンでは従来どおり完了サマリへ
  const [quizQuestions, setQuizQuestions] = useState<LessonQuizQuestion[]>([]);
  const [quizRun, setQuizRun] = useState(0);
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizReplaying, setQuizReplaying] = useState(false);
  const quizReplayRef = useRef<number | null>(null);
  const quizReplayPlayingRef = useRef(false);
  // 計測用: 完了済みフラグ (lesson_abandoned を完了後に発火しない) と現在位置の ref
  const completedRef = useRef(false);
  const effectivePosRef = useRef(0);

  const nextLessonPick = (() => {
    const list = getLessonList();
    if (focusType) {
      const completedIds = new Set<string>();
      for (const day of Object.values(progressDays)) {
        for (const id of day.completedLessons ?? []) completedIds.add(id);
      }
      return pickNextOvercomingLesson(focusType, lesson.id, completedIds, list);
    }
    const i = list.findIndex((it) => it.entry.id === lesson.id);
    for (let j = i + 1; j < list.length; j++) {
      if (list[j].bundle) return { item: list[j], reason: null as string | null };
    }
    return null;
  })();

  const targetSentencePositions = useMemo(
    () => (focusType ? getTargetSentenceIndicesForType(lesson, focusType) : []),
    [lesson, focusType],
  );

  const prefs = getPlayerPrefs();
  useEffect(() => {
    logEvent('lesson_started', { lessonId: lesson.id });
  }, [lesson.id]);

  const clampedInitialPos =
    initialSentenceIndex !== null &&
    initialSentenceIndex >= 0 &&
    initialSentenceIndex < sentences.length
      ? initialSentenceIndex
      : targetSentencePositions[0] ?? 0;

  const initialResolvedMode: LessonMode =
    initialMode ?? (autorecordParam ? 'speak' : focusType ? 'listen' : prefs.lessonMode);

  const [overcomingDone, setOvercomingDone] = useState<Record<OvercomingStepKey, boolean>>(() => ({
    listen: false,
    read: initialResolvedMode === 'read',
    speak: false,
  }));
  const loggedOvercomingRef = useRef<Set<OvercomingStepKey>>(new Set());
  const overcomingMasteryRecordedRef = useRef(false);

  const markOvercomingStep = (step: OvercomingStepKey) => {
    if (!focusType) return;
    if (!loggedOvercomingRef.current.has(step)) {
      loggedOvercomingRef.current.add(step);
      logEvent('overcoming_step_completed', {
        lesson_id: lesson.id,
        sound_change_type: focusType,
        step,
      });
    }
    setOvercomingDone((prev) => {
      const next = prev[step] ? prev : { ...prev, [step]: true };
      if (
        next.listen &&
        next.read &&
        next.speak &&
        !overcomingMasteryRecordedRef.current
      ) {
        overcomingMasteryRecordedRef.current = true;
        recordMasteryOvercomingCompleted(focusType);
      }
      return next;
    });
  };

  const [lessonMode, setLessonModeState] = useState<LessonMode>(initialResolvedMode);
  const [focusedPos, setFocusedPos] = useState<number>(clampedInitialPos);
  const [rate, setRate] = useState<PlaybackRate>(prefs.rate);
  const [showChunkJa, setShowChunkJaState] = useState(prefs.showChunkJa);
  const [autoRecordAfterModel, setAutoRecordAfterModelState] = useState(
    prefs.autoRecordAfterModel
  );
  const [repeatSentence, setRepeatSentence] = useState<number | null>(null);
  const [ab, setAb] = useState<{ a: number; b: number } | null>(null);

  // ボトムシートの段階開示状態 (D6 / D7)
  const initialLinkingIdx =
    initialSheet === 'linking' && (sentences[clampedInitialPos]?.linking.length ?? 0) > 0
      ? { sentenceIndex: sentences[clampedInitialPos].index, noteIndex: 0 }
      : null;
  const [linkingSheetTarget, setLinkingSheetTarget] = useState<{
    sentenceIndex: number;
    noteIndex: number;
  } | null>(initialLinkingIdx);
  const [showLegendSheet, setShowLegendSheet] = useState(initialSheet === 'legend');
  const [showToolsSheet, setShowToolsSheet] = useState(initialSheet === 'tools');

  const toggleChunkJa = () => {
    setShowChunkJaState(togglePlayerPrefsChunkJa());
  };
  const toggleAutoRecord = () => {
    setAutoRecordAfterModelState((prev) => {
      const next = !prev;
      setPlayerPrefsAutoRecord(next);
      return next;
    });
  };

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    }).catch(() => {});
    void initBillingAsync();
  }, []);

  const player = useAudioPlayer(bundle.audio, {
    updateInterval: STATUS_UPDATE_INTERVAL_MILLIS,
  });
  const status = useAudioPlayerStatus(player);

  const rateAppliedRef = useRef(false);
  useEffect(() => {
    if (rateAppliedRef.current || prefs.rate === 1.0) return;
    rateAppliedRef.current = true;
    player.setPlaybackRate(prefs.rate, PITCH_CORRECTION_QUALITY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player]);

  // 初期 ?sentence=<n> または ?focus=<type> 指定時は再生位置も対象文の先頭へ合わせる
  const initialSeekRef = useRef(false);
  useEffect(() => {
    if (initialSeekRef.current || clampedInitialPos <= 0) return;
    const target = sentences[clampedInitialPos];
    if (!target) return;
    initialSeekRef.current = true;
    void player.seekTo(target.startSec, SEEK_TOLERANCE_MILLIS, SEEK_TOLERANCE_MILLIS).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player]);

  const append = (action: string) => {
    if (__DEV__) {
      const at = new Date().toLocaleTimeString('ja-JP', { hour12: false });
      console.log(`[lesson] ${at} ${action}`);
    }
  };

  const seekTo = (
    seconds: number,
    label: string,
    onDone?: () => void,
    onFail?: () => void
  ) => {
    const clamped = Math.min(Math.max(seconds, 0), status.duration || lesson.durationSec);
    player
      .seekTo(clamped, SEEK_TOLERANCE_MILLIS, SEEK_TOLERANCE_MILLIS)
      .then(() => {
        onDone?.();
        append(label);
      })
      .catch(() => {
        append(`seekTo(${clamped}) 失敗`);
        onFail?.();
      });
  };

  const manuallyPausedRef = useRef(false);
  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // --- シャドーイング録音・連続聞き比べ状態 ---
  const [recordingSentence, setRecordingSentence] = useState<number | null>(null);
  const [recorderStatus, setRecorderStatus] = useState<RecordingStatus | null>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY, (recStatus) =>
    setRecorderStatus(recStatus)
  );
  const [micDenied, setMicDenied] = useState(false);
  const [lastRecordings, setLastRecordings] = useState<
    Record<number, { uri: string; durationSec: number }>
  >({});
  const [sessionShadowingCount, setSessionShadowingCount] = useState(0);
  const [shadowingCounts, setShadowingCounts] = useState<Record<number, number>>(() =>
    getShadowingCounts(lesson.id)
  );
  const [comparing, setComparing] = useState<{ index: number; source: 'model' | 'user' } | null>(
    null
  );
  const [pendingRecord, setPendingRecord] = useState<number | null>(null);
  const pendingRecordRef = useRef<number | null>(null);
  const recordStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const compareTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const compareSeqRef = useRef<{ sentenceIndex: number; gen: number } | null>(null);
  const recordGenRef = useRef(0);
  const seekTokenRef = useRef(0);
  const userAudioRef = useRef<AudioPlayer | null>(null);
  const userPlayTokenRef = useRef(0);
  const lastRecordingsRef = useRef(lastRecordings);
  useEffect(() => {
    lastRecordingsRef.current = lastRecordings;
  }, [lastRecordings]);

  const setPendingRecordBoth = (v: number | null) => {
    pendingRecordRef.current = v;
    setPendingRecord(v);
    recordGenRef.current += 1;
  };

  const cancelAsyncFlow = () => {
    if (recordStartTimerRef.current) {
      clearTimeout(recordStartTimerRef.current);
      recordStartTimerRef.current = null;
    }
    if (compareTimerRef.current) {
      clearTimeout(compareTimerRef.current);
      compareTimerRef.current = null;
    }
    compareSeqRef.current = null;
    if (pendingRecordRef.current !== null) {
      setPendingRecordBoth(null);
    } else {
      recordGenRef.current += 1;
    }
    seekTokenRef.current += 1;
    userAudioRef.current?.pause();
    setComparing(null);
  };

  const play = (label = 'play()') => {
    manuallyPausedRef.current = false;
    player.play();
    append(label);
  };
  const pause = (label = 'pause()') => {
    manuallyPausedRef.current = true;
    player.pause();
    append(label);
  };
  const applyRate = (nextRate: PlaybackRate, label?: string) => {
    setRate(nextRate);
    setPlayerPrefsRate(nextRate);
    player.setPlaybackRate(nextRate, PITCH_CORRECTION_QUALITY);
    append(label ?? `setPlaybackRate(${nextRate}, ${PITCH_CORRECTION_QUALITY})`);
    logEvent('playback_control', { lessonId: lesson.id, action: 'speed' });
  };

  const togglePlay = () => {
    cancelAsyncFlow();
    if (status.playing) {
      pause();
    } else if (
      repeatSentence === null &&
      (status.didJustFinish || (status.duration > 0 && status.currentTime >= status.duration - 0.05))
    ) {
      logEvent('playback_control', { lessonId: lesson.id, action: 'replay' });
      setFocusedPos(0);
      seekTo(0, 'seekTo(0) // 終端から先頭へ', () => play());
    } else {
      play();
    }
  };

  const startRecording = async (sentenceIndex: number) => {
    if (recordingSentence !== null) return;
    // 非同期の権限・音声モード設定の待機中にモード切替やキャンセルが入ったら
    // 録音を開始しない (世代トークンで検証する)
    const gen = recordGenRef.current;
    player.pause();
    userAudioRef.current?.pause();
    const permission = await requestRecordingPermissionsAsync();
    if (recordGenRef.current !== gen) return;
    if (!permission.granted) {
      setMicDenied(true);
      append('マイク権限が拒否されています');
      return;
    }
    setMicDenied(false);
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      if (recordGenRef.current !== gen) return;
      recorder.record();
      setRecordingSentence(sentenceIndex);
      append(`録音開始: 文${sentenceIndex + 1}`);
    } catch {
      append('録音の開始に失敗しました');
    }
  };

  const stopRecording = async (sentenceIndex: number) => {
    const duration = recorder.currentTime;
    try {
      await recorder.stop();
    } catch {
      append('録音の停止に失敗しました');
      setRecordingSentence(null);
      return;
    }
    const uri = recorder.uri;
    setRecordingSentence(null);
    void setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
    if (!uri) {
      append('録音ファイルを取得できませんでした');
      return;
    }
    setLastRecordings((prev) => ({ ...prev, [sentenceIndex]: { uri, durationSec: duration } }));
    setShadowingCounts(addShadowingCount(lesson.id, sentenceIndex));
    setSessionShadowingCount((c) => c + 1);
    addShadowingRecord(lesson.id);
    const recSentence = sentences.find((s) => s.index === sentenceIndex);
    const recTypes = recSentence ? recSentence.linking.map((n) => n.type) : [];
    recordMasteryShadowing(recTypes);
    if (focusType) {
      markOvercomingStep('speak');
    }
    logEvent('shadowing_recorded', { lessonId: lesson.id });
    append(`録音完了: 文${sentenceIndex + 1} ${duration.toFixed(1)} 秒`);
  };

  const playModel = (sentenceIndex: number, keepCompareSeq = false) => {
    const sentence = sentences.find((s) => s.index === sentenceIndex);
    if (!sentence) return;
    if (!keepCompareSeq) {
      compareSeqRef.current = null;
      // 手動のお手本再生を優先し、予約済みの聞き比べ/録音開始タイマーを取り消す
      if (compareTimerRef.current) {
        clearTimeout(compareTimerRef.current);
        compareTimerRef.current = null;
      }
      if (recordStartTimerRef.current) {
        clearTimeout(recordStartTimerRef.current);
        recordStartTimerRef.current = null;
      }
      recordGenRef.current += 1;
    }
    if (pendingRecordRef.current !== null && pendingRecordRef.current !== sentenceIndex) {
      setPendingRecordBoth(null);
    }
    userAudioRef.current?.pause();
    setComparing({ index: sentenceIndex, source: 'model' });
    const token = ++seekTokenRef.current;
    seekTo(sentence.startSec, `お手本再生: 文${sentenceIndex + 1}`, () => {
      if (seekTokenRef.current === token) play();
    });
  };

  const playUserRecording = (sentenceIndex: number) => {
    const rec = lastRecordingsRef.current[sentenceIndex];
    if (!rec) return;
    player.pause();
    userAudioRef.current?.release();
    const userPlayer = createAudioPlayer(rec.uri);
    userAudioRef.current = userPlayer;
    const token = ++userPlayTokenRef.current;
    userPlayer.addListener('playbackStatusUpdate', (st) => {
      if (st.didJustFinish && userPlayTokenRef.current === token) {
        setComparing(null);
      }
    });
    userPlayer.play();
    setComparing({ index: sentenceIndex, source: 'user' });
    append(`自分の録音を再生: 文${sentenceIndex + 1} (${rec.durationSec.toFixed(1)} 秒)`);
  };

  const beginRecordFlow = (sentenceIndex: number) => {
    if (recordingSentence !== null) return;
    compareSeqRef.current = null;
    if (pendingRecordRef.current === sentenceIndex) {
      setPendingRecordBoth(null);
      seekTokenRef.current += 1;
      player.pause();
      append('録音予約を取り消しました');
      return;
    }
    if (!autoRecordAfterModel) {
      void startRecording(sentenceIndex);
      return;
    }
    setPendingRecordBoth(sentenceIndex);
    playModel(sentenceIndex);
    append(`お手本の後に録音します: 文${sentenceIndex + 1}`);
  };

  const compareSequential = (sentenceIndex: number) => {
    if (recordingSentence !== null) return;
    if (!lastRecordingsRef.current[sentenceIndex]) return;
    cancelAsyncFlow();
    const gen = recordGenRef.current;
    compareSeqRef.current = { sentenceIndex, gen };
    playModel(sentenceIndex, true);
    logEvent('shadowing_compared', { lessonId: lesson.id });
    append(`連続聞き比べ開始: 文${sentenceIndex + 1}`);
  };

  // --- 文移動・モード切替 ---
  const goToPosition = (pos: number, keepPlaying = true) => {
    const clamped = Math.min(Math.max(pos, 0), sentences.length - 1);
    const target = sentences[clamped];
    if (!target) return;
    cancelAsyncFlow();
    setFocusedPos(clamped);
    setRepeatSentence(null);
    setAb(null);
    if (!keepPlaying && statusRef.current.playing) {
      pause('文移動のため一時停止');
    }
    const shouldResume = keepPlaying && statusRef.current.playing;
    seekTo(target.startSec, `文${clamped + 1} へ移動`, () => {
      if (shouldResume) play();
    });
  };

  const lastStartedPosition = () => {
    const tNow = statusRef.current.currentTime;
    if (tNow <= 0.01) return focusedPos;
    let pos = 0;
    sentences.forEach((st, i) => {
      if (tNow >= st.startSec) pos = i;
    });
    return pos;
  };

  const goPrevSentence = () => {
    logEvent('playback_control', { lessonId: lesson.id, action: 'jump' });
    const pos = lastStartedPosition();
    if (lessonMode === 'speak') {
      goToPosition(Math.max(0, pos - 1), false);
      return;
    }
    const current = sentences[pos];
    if (current && statusRef.current.currentTime - current.startSec > 2) {
      goToPosition(pos);
    } else {
      goToPosition(Math.max(0, pos - 1));
    }
  };

  const goNextSentence = () => {
    logEvent('playback_control', { lessonId: lesson.id, action: 'jump' });
    const pos = lastStartedPosition();
    if (lessonMode === 'speak') {
      goToPosition(Math.min(sentences.length - 1, pos + 1), false);
      return;
    }
    goToPosition(Math.min(sentences.length - 1, pos + 1));
  };

  const rewind3s = () => {
    cancelAsyncFlow();
    const target = Math.max(0, statusRef.current.currentTime - 3);
    logEvent('playback_control', { lessonId: lesson.id, action: 'jump' });
    seekTo(target, '3秒戻る');
  };

  const switchMode = (nextMode: LessonMode) => {
    if (nextMode === lessonMode) return;
    if (recordingSentence !== null) {
      void stopRecording(recordingSentence);
    }
    cancelAsyncFlow();
    // リピート状態はモードをまたいで持ち込まない (話すモードのお手本再生への干渉防止)
    setRepeatSentence(null);
    setAb(null);
    if (nextMode === 'speak' && statusRef.current.playing) {
      pause('話すモードへ切替');
    }
    setLessonModeState(nextMode);
    setPlayerPrefsLessonMode(nextMode);
    if (focusType && nextMode === 'read') {
      markOvercomingStep('read');
    }
    logEvent('lesson_mode_changed', { lessonId: lesson.id, mode: nextMode });
  };

  const toggleRepeat = (sentenceIndex: number) => {
    const next = repeatSentence === sentenceIndex ? null : sentenceIndex;
    setRepeatSentence(next);
    append(
      next === null
        ? `文${sentenceIndex + 1} リピート解除`
        : `文${sentenceIndex + 1} リピート開始`
    );
  };

  const setAbPoint = (which: 'a' | 'b') => {
    logEvent('playback_control', { lessonId: lesson.id, action: 'ab_repeat' });
    const now = statusRef.current.currentTime;
    const duration = statusRef.current.duration || lesson.durationSec;
    setAb((prev) => {
      const a = which === 'a' ? now : (prev?.a ?? Math.max(0, now - 3));
      const b = which === 'b' ? now : (prev?.b ?? Math.min(duration, now + 3));
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      return hi - lo > 0.2 ? { a: lo, b: hi } : (prev ?? null);
    });
    append(`AB: ${which.toUpperCase()} 設定`);
  };

  const clearAb = () => {
    setAb(null);
    append('AB リピート解除');
    logEvent('playback_control', { lessonId: lesson.id, action: 'ab_repeat' });
  };

  // アンマウント時に録音と一時ファイルを破棄 (GM 決定)
  useEffect(() => {
    return () => {
      if (recordStartTimerRef.current) clearTimeout(recordStartTimerRef.current);
      if (compareTimerRef.current) clearTimeout(compareTimerRef.current);
      try {
        recorder.stop();
      } catch {
        // 録音していない場合は無視
      }
      void setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
      userAudioRef.current?.release();
      userAudioRef.current = null;
      for (const rec of Object.values(lastRecordingsRef.current)) {
        if (rec.uri.startsWith('file://')) {
          void deleteAsync(rec.uri, { idempotent: true }).catch(() => {});
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ?demo=1 / ?autorecord=1 / ?autostudy=1 自動検証用フック
  const demoRanRef = useRef(false);
  useEffect(() => {
    if (!__DEV__ || !demoParam || demoRanRef.current) return;
    demoRanRef.current = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (delayMs: number, fn: () => void) => {
      timers.push(setTimeout(fn, delayMs));
    };
    at(500, () => play('play()'));
    at(2500, () => applyRate(1.15));
    at(4500, () => applyRate(1.0));
    at(5500, () => {
      const s3 = sentences.find((s) => s.index === 2);
      if (s3) seekTo(s3.startSec, '文3 冒頭へ');
    });
    at(7000, () => setAbPoint('a'));
    at(8500, () => setAbPoint('b'));
    at(10000, () => pause('デモ終了'));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoParam, player]);

  const autoRecordRanRef = useRef(false);
  useEffect(() => {
    if (!__DEV__ || !autorecordParam || autoRecordRanRef.current) return;
    autoRecordRanRef.current = true;
    const target = sentences[clampedInitialPos]?.index ?? 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => void startRecording(target), 1800));
    timers.push(setTimeout(() => void stopRecording(target), 6800));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autorecordParam]);

  const autoStudyRanRef = useRef(false);
  useEffect(() => {
    if (!__DEV__ || !autostudyParam || autoStudyRanRef.current) return;
    autoStudyRanRef.current = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => play('自動学習デモ: play()'), 800));
    timers.push(setTimeout(() => pause('自動学習デモ: pause()'), 6800));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autostudyParam, player]);

  // 完了判定 + サマリモーダル
  const seekingRef = useRef(false);
  const repeatSentenceRef = useRef<number | null>(null);
  const abRef = useRef<{ a: number; b: number } | null>(null);
  const playedSecondsRef = useRef(0);
  const sessionTotalSecondsRef = useRef(0);
  const lastPlaybackTRef = useRef(0);
  const playedDateRef = useRef<string>(localDateStr());

  useEffect(() => {
    repeatSentenceRef.current = repeatSentence;
  }, [repeatSentence]);
  useEffect(() => {
    abRef.current = ab;
  }, [ab]);

  useEffect(() => {
    if (status.didJustFinish) {
      completedRef.current = true;
      // 完了後の再生 (クイズの「もう一度聞く」等) で音声終端に再到達しても、
      // 完了の記録・習熟度加算・計測は初回の 1 回だけ発火させる
      // 日別の完了記録は画面を開いたまま日付をまたいで再完走したときも残すため、
      // 初回判定の外で呼ぶ (同日の重複は markLessonCompleted 側で除外される)
      markLessonCompleted(lesson.id);
      // 完了したレッスンに再開位置は不要なので消す (ホームで再開ダイアログを出さない)
      clearLessonResumePosition(lesson.id);
      if (!lessonCompletedFiredRef.current) {
        lessonCompletedFiredRef.current = true;
        recordMasteryLessonCompleted(
          sentences.flatMap((s) => s.linking.map((n) => n.type)),
        );
        logEvent('lesson_completed', {
          lessonId: lesson.id,
          seconds: Math.round(sessionTotalSecondsRef.current),
        });
      }
      if (!summaryShownRef.current) {
        summaryShownRef.current = true;
        setSummarySeconds(Math.round(sessionTotalSecondsRef.current));
        // デモ時はクイズを出さず従来どおり。0 問なら完了サマリへフォールバック
        const questions = demoParam ? [] : buildLessonQuiz(lesson, weakSentences);
        if (questions.length > 0) {
          setQuizQuestions(questions);
          setQuizRun((n) => n + 1);
          setShowQuiz(true);
          logEvent('lesson_quiz_shown', { lessonId: lesson.id, questionCount: questions.length });
        } else {
          setShowSummary(true);
        }
      }
    }
  }, [status.didJustFinish, lesson, sentences, demoParam, weakSentences]);

  // --- ミニ聞き分けクイズ (#103): 文区間の再生・解答・終了 ---
  // 既存 player のシーク→再生→文末 pause を使う (新しい Audio は作らない)。
  // AB リピート・単文リピートと競合しないよう、再生前にそれらを解除する
  const replayQuizSentence = (question: LessonQuizQuestion) => {
    if (quizReplaying) return;
    const sentence = sentences.find((s) => s.index === question.sentenceIndex);
    if (!sentence) return;
    cancelAsyncFlow();
    setAb(null);
    setRepeatSentence(null);
    setQuizReplaying(true);
    quizReplayPlayingRef.current = false;
    quizReplayRef.current = sentence.index;
    const token = ++seekTokenRef.current;
    seekTo(
      sentence.startSec,
      `クイズ: 文${sentence.index + 1} をもう一度聞く`,
      () => {
        if (seekTokenRef.current !== token) return;
        play();
        // play() は失敗を通知しないため、シーク後すぐに再生が始まらなければ状態を戻す
        // (「再生中…」でボタンが固まるのを防ぐフォールバック)
        setTimeout(() => {
          if (quizReplayRef.current !== sentence.index) return;
          if (!quizReplayPlayingRef.current) {
            quizReplayRef.current = null;
            setQuizReplaying(false);
          }
        }, 1500);
      },
      () => {
        quizReplayRef.current = null;
        setQuizReplaying(false);
      },
    );
  };

  useEffect(() => {
    const target = quizReplayRef.current;
    if (target === null || !showQuiz) return;
    const sentence = sentences.find((s) => s.index === target);
    if (!sentence) return;
    const endThreshold =
      status.duration > 0 ? Math.min(sentence.endSec, status.duration - 0.05) : sentence.endSec;
    if (status.playing) quizReplayPlayingRef.current = true;
    const reachedEnd =
      status.playing &&
      (status.didJustFinish || status.currentTime >= endThreshold - 0.02);
    const stoppedAfterStart = quizReplayPlayingRef.current && !status.playing;
    // 文末 (または音声終端) に達したら停止し、再生中状態を解除する
    if (reachedEnd || stoppedAfterStart) {
      if (reachedEnd) pause('クイズ: 文末で停止');
      quizReplayPlayingRef.current = false;
      quizReplayRef.current = null;
      setQuizReplaying(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.currentTime, status.playing, status.didJustFinish, status.duration, showQuiz]);

  const finishQuiz = () => {
    // 再生中に閉じた場合は音声を止める (完了サマリの裏で鳴り続けないように)
    if (quizReplayRef.current !== null) pause('クイズ: 終了時に再生を停止');
    quizReplayRef.current = null;
    setQuizReplaying(false);
    setShowQuiz(false);
    setShowSummary(true);
  };

  const handleQuizAnswered = (
    question: LessonQuizQuestion,
    _selectedText: string,
    correct: boolean,
  ) => {
    logEvent('lesson_quiz_answered', {
      lessonId: lesson.id,
      questionIndex: quizQuestions.indexOf(question),
      correct,
      soundChangeType: question.soundChangeType,
      wasWeak: question.wasWeak,
    });
    // 正誤連動: 登録済み文は復習結果を記録。未登録で不正解なら苦手フレーズに追加してから記録
    if (isSentenceWeak(lesson.id, question.sentenceIndex)) {
      recordWeakSentenceReview(lesson.id, question.sentenceIndex, correct);
    } else if (!correct) {
      toggleWeakSentence(lesson.id, question.sentenceIndex);
      recordWeakSentenceReview(lesson.id, question.sentenceIndex, false);
    }
    recordMasteryQuiz([{ type: question.soundChangeType, correct }]);
  };

  // AB リピート
  useEffect(() => {
    if (ab === null || seekingRef.current) return;
    if (status.didJustFinish || status.currentTime >= ab.b - 0.05) {
      seekingRef.current = true;
      seekTo(
        ab.a,
        'AB リピート',
        () => {
          seekingRef.current = false;
          if (abRef.current !== null && !manuallyPausedRef.current) {
            play();
          }
        },
        () => {
          seekingRef.current = false;
        }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.currentTime, status.playing, status.didJustFinish, status.duration, ab]);

  // 単文リピート
  useEffect(() => {
    if (repeatSentence === null || ab !== null) return;
    const sentence = sentences.find((s) => s.index === repeatSentence);
    if (!sentence) return;
    const endThreshold =
      status.duration > 0 ? Math.min(sentence.endSec, status.duration - 0.05) : sentence.endSec;
    if (seekingRef.current) return;
    if (status.didJustFinish || status.currentTime >= endThreshold) {
      seekingRef.current = true;
      const wasPlaying = status.playing;
      seekTo(
        sentence.startSec,
        '文リピート',
        () => {
          seekingRef.current = false;
          if (wasPlaying && repeatSentenceRef.current === sentence.index) {
            play();
          }
        },
        () => {
          seekingRef.current = false;
        }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.currentTime, status.playing, status.didJustFinish, status.duration, repeatSentence]);

  // 再生時間記録 (1秒以上の進行のみ蓄積)
  const t = status.currentTime;
  useEffect(() => {
    if (status.playing && t > lastPlaybackTRef.current && t - lastPlaybackTRef.current < 2) {
      playedSecondsRef.current += t - lastPlaybackTRef.current;
      sessionTotalSecondsRef.current += t - lastPlaybackTRef.current;
    }
    lastPlaybackTRef.current = t;
    const today = localDateStr();
    if (today !== playedDateRef.current) {
      if (playedSecondsRef.current >= 1) {
        addStudySeconds(lesson.id, playedSecondsRef.current, playedDateRef.current);
        playedSecondsRef.current = 0;
      }
      playedDateRef.current = today;
    }
  }, [t, status.playing, lesson.id]);

  useEffect(() => {
    if (playedSecondsRef.current >= 1) {
      addStudySeconds(lesson.id, playedSecondsRef.current, playedDateRef.current);
      playedSecondsRef.current = 0;
    }
  }, [status.playing, status.didJustFinish, lesson.id]);

  useEffect(() => {
    return () => {
      if (playedSecondsRef.current >= 1) {
        addStudySeconds(lesson.id, playedSecondsRef.current, playedDateRef.current);
        playedSecondsRef.current = 0;
      }
    };
  }, [lesson.id]);

  // 現在文と表示対象文の導出 (宣言順序を維持して React Compiler に準拠)
  // 文間の無音区間でも直前に開始した文を維持し、シーク/再生開始前の t <= 0.01 では focusedPos を使う
  const activePos = useMemo(() => {
    return sentences.findIndex((s) => t >= s.startSec && t < s.endSec);
  }, [sentences, t]);

  const timePos = useMemo(() => {
    if (t <= 0.01) return -1;
    let pos = 0;
    sentences.forEach((st, i) => {
      if (t >= st.startSec) pos = i;
    });
    return pos;
  }, [sentences, t]);

  const effectivePos = timePos >= 0 ? timePos : focusedPos;
  const displaySentence = sentences[effectivePos] ?? sentences[0];

  // 計測用に現在位置を ref へミラーする (アンマウント時の判定で使う)
  useEffect(() => {
    effectivePosRef.current = effectivePos;
  }, [effectivePos]);

  // 再開位置は文が進むたびに保存する (アンマウント時にアプリが殺されても失わないようにする)。
  // 完了後は保存しない (完了処理で clear される)。
  useEffect(() => {
    if (completedRef.current) return;
    saveLessonResumePosition(lesson.id, effectivePos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectivePos]);

  // 未完了のままレッスンを離れたら lesson_abandoned を記録する (完了後は記録しない)。
  // このコンポーネントはレッスン ID で key 付けされるため、アンマウント = 離脱とみなせる。
  useEffect(() => {
    return () => {
      if (completedRef.current) return;
      const total = sentences.length;
      const ratio = total > 0 ? effectivePosRef.current / total : 0;
      const progressBucket =
        ratio < 0.25 ? '0-25' : ratio < 0.5 ? '25-50' : ratio < 0.75 ? '50-75' : '75-99';
      logEvent('lesson_abandoned', { lessonId: lesson.id, progressBucket });
      // 未完了のまま離脱したら、最終再生文位置を保存してホームから再開できるようにする
      if (effectivePosRef.current >= 1) {
        saveLessonResumePosition(lesson.id, effectivePosRef.current);
      } else {
        clearLessonResumePosition(lesson.id);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Apple Watch 連携 (Phase 1): 再生状態の送信と Watch からの操作の受付 ---
  // ハンドラはマウント中だけ登録し、最新の操作関数一式は ref 経由で参照する
  // (statusRef と同じパターン。Watch 側の操作で古いクロージャを掴まないため)。
  const watchControlsRef = useRef({ togglePlay, goNextSentence, goPrevSentence, applyRate, rate });
  useEffect(() => {
    watchControlsRef.current = { togglePlay, goNextSentence, goPrevSentence, applyRate, rate };
  });
  // この画面インスタンスの所有者トークン (新旧共存時の誤消去防止は watchSync 側)
  const watchTokenRef = useRef<object>({});

  useEffect(() => {
    // 文送り/文戻しは画面上のボタンと同じ関数を使う (2秒超で文頭に戻る挙動や、
    // 話すモードで一時停止したまま移動する挙動を Watch でも揃える)。
    const watchToken = watchTokenRef.current;
    claimWatchPlayback(watchToken);
    const unregister = registerWatchCommandHandler((command) => {
      const controls = watchControlsRef.current;
      if (command.type === 'togglePlay') {
        controls.togglePlay();
      } else if (command.type === 'nextSentence') {
        controls.goNextSentence();
      } else if (command.type === 'prevSentence') {
        controls.goPrevSentence();
      } else if (command.type === 'cycleRate') {
        const index = PLAYBACK_RATES.indexOf(controls.rate);
        controls.applyRate(PLAYBACK_RATES[(index + 1) % PLAYBACK_RATES.length]);
      }
    });
    return () => {
      unregister();
      pushWatchPlayback(null, watchToken);
    };
  }, [sentences.length]);

  useEffect(() => {
    const sentence = sentences[effectivePos];
    if (!sentence) return;
    pushWatchPlayback(
      {
        lessonTitle: lesson.titleJa || lesson.title,
        sentenceIndex: effectivePos,
        sentenceCount: sentences.length,
        textEn: sentence.text,
        textJa: sentence.translationJa,
        isPlaying: status.playing,
        rate,
      },
      watchTokenRef.current,
    );
  }, [effectivePos, status.playing, rate, lesson, sentences]);


  const activeWordIndex = useMemo(() => {
    if (activePos !== effectivePos || !displaySentence) return -1;
    return displaySentence.words.findIndex((w) => t >= w.startSec && t < w.endSec);
  }, [activePos, effectivePos, displaySentence, t]);

  const activeChunkIndex = useMemo(() => {
    if (activePos !== effectivePos || !displaySentence) return -1;
    return displaySentence.chunks.findIndex((c) => t >= c.startSec && t < c.endSec);
  }, [activePos, effectivePos, displaySentence, t]);

  // お手本区間再生の文末停止 → 自動録音 or 連続聞き比べ
  const comparingModelEndSec = useMemo(() => {
    if (comparing?.source !== 'model') return null;
    return sentences.find((s) => s.index === comparing.index)?.endSec ?? null;
  }, [comparing, sentences]);
  const modelCompareActive =
    comparing?.source === 'model' && comparingModelEndSec !== null && t < comparingModelEndSec;
  const modelPausedRef = useRef(false);
  useEffect(() => {
    modelPausedRef.current = false;
  }, [comparing]);

  useEffect(() => {
    if (!modelCompareActive) return;
    if (!modelPausedRef.current && t >= (comparingModelEndSec ?? 0) - 0.02) {
      player.pause();
      modelPausedRef.current = true;
      const pending = pendingRecordRef.current;
      if (pending !== null && comparing?.index === pending) {
        setPendingRecordBoth(null);
        const gen = recordGenRef.current;
        recordStartTimerRef.current = setTimeout(() => {
          if (recordGenRef.current === gen) {
            void startRecording(pending);
          }
        }, 600);
        return;
      }
      const seq = compareSeqRef.current;
      if (seq && comparing?.index === seq.sentenceIndex && seq.gen === recordGenRef.current) {
        compareSeqRef.current = null;
        const seqGen = seq.gen;
        const idx = seq.sentenceIndex;
        compareTimerRef.current = setTimeout(() => {
          if (recordGenRef.current === seqGen) {
            playUserRecording(idx);
          }
        }, 400);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, modelCompareActive, comparingModelEndSec]);

  const legendTypes = useMemo(() => {
    const set = new Set<LessonLinkingNote['type']>();
    for (const s of sentences) {
      for (const n of s.linking) {
        set.add(n.type);
      }
    }
    return [...set];
  }, [sentences]);

  const keyPhrase = useMemo(() => getLessonKeyPhrase(lesson), [lesson]);
  const keyPhrasePos = useMemo(
    () =>
      keyPhrase ? sentences.findIndex((s) => s.index === keyPhrase.sentenceIndex) : -1,
    [keyPhrase, sentences]
  );

  const abPhrase = useMemo(() => {
    if (!ab) return null;
    const texts = sentences
      .flatMap((sen) => sen.words)
      .filter((w) => w.endSec > ab.a + 0.01 && w.startSec < ab.b - 0.01)
      .map((w) => w.text);
    if (texts.length === 0) return null;
    return texts.length > 14
      ? `${texts.slice(0, 7).join(' ')} … ${texts.slice(-5).join(' ')}`
      : texts.join(' ');
  }, [ab, sentences]);

  // スクリプトモードで ?sentence=<n> 指定時にスクロール
  const scrollRef = useRef<ComponentRef<typeof ScrollView> | null>(null);
  const sentenceCardRefs = useRef<
    Record<
      number,
      { measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => void } | null
    >
  >({});
  const autoScrolledRef = useRef(false);
  useEffect(() => {
    if (lessonMode !== 'script' || initialSentenceIndex === null || autoScrolledRef.current) return;
    const targetSentence = sentences[clampedInitialPos];
    if (!targetSentence) return;
    const timer = setTimeout(() => {
      const card = sentenceCardRefs.current[targetSentence.index];
      const scroller = scrollRef.current;
      if (!card || !scroller) return;
      scroller.measureInWindow((_sx: number, sy: number) => {
        card.measureInWindow((_x, y: number) => {
          scroller.scrollTo({ y: Math.max(y - sy - 160, 0), animated: true });
          autoScrolledRef.current = true;
        });
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [lessonMode, initialSentenceIndex, clampedInitialPos, sentences]);

  const handleWordPress = (sentence: LessonSentence, wordIndex: number) => {
    const noteIndex = wordLinkMap(sentence)[wordIndex];
    if (noteIndex === null || noteIndex === undefined) return;
    setLinkingSheetTarget({ sentenceIndex: sentence.index, noteIndex });
    const note = sentence.linking[noteIndex];
    if (note) {
      append(`音の変化: ${note.span} (${LINKING_LABELS[note.type]})`);
      recordMasteryLinkingNoteOpened(note.type);
      if (focusType && note.type === focusType) {
        markOvercomingStep('listen');
      }
      logEvent('linking_note_opened', { lessonId: lesson.id, soundChangeType: note.type });
    }
  };

  const progress = status.duration > 0 ? Math.min(1, status.currentTime / status.duration) : 0;
  const sentenceRatio = (effectivePos + 1) / Math.max(sentences.length, 1);
  const weakActiveColor = colors.warning;

  const sheetSentence = linkingSheetTarget
    ? (sentences.find((s) => s.index === linkingSheetTarget.sentenceIndex) ?? null)
    : null;

  const isWeakCurrent = displaySentence ? isSentenceWeak(lesson.id, displaySentence.index) : false;
  const goalStatus = computeDailyGoalStatus(computeTodaySeconds(progressDays), dailyGoalMinutes);

  return (
    <Screen
      hasHeader
      scrollRef={scrollRef}
      footer={
        lessonMode === 'speak' && displaySentence ? (
          <ShadowingFooterBar
            sentenceIndex={effectivePos}
            sentenceCount={sentences.length}
            rate={rate}
            isRecording={recordingSentence === displaySentence.index}
            recordingElapsedSec={recorder.currentTime}
            isPendingRecord={pendingRecord === displaySentence.index}
            autoRecordAfterModel={autoRecordAfterModel}
            onOpenTools={() => setShowToolsSheet(true)}
            onPrev={goPrevSentence}
            onNext={goNextSentence}
            onTriggerRecord={() => beginRecordFlow(displaySentence.index)}
            onStopRecord={() => void stopRecording(displaySentence.index)}
          />
        ) : (
          <TransportBar
            progress={progress}
            currentTime={status.currentTime}
            duration={status.duration || lesson.durationSec}
            playing={status.playing}
            sentenceIndex={effectivePos}
            sentenceCount={sentences.length}
            firstStartSec={sentences[0]?.startSec ?? 0}
            rate={rate}
            abActive={ab !== null}
            onOpenTools={() => setShowToolsSheet(true)}
            onPrev={goPrevSentence}
            onRewind3s={rewind3s}
            onNext={goNextSentence}
            onTogglePlay={togglePlay}
            onSeek={(sec) => seekTo(sec, 'シークバー')}
          />
        )
      }
    >
      <Stack.Screen
        options={{ headerShown: true, title: lesson.titleJa, headerBackTitle: '戻る' }}
      />

      {/* 上端 3pt 進捗バー (R3.1: 戻る + タイトル1行 + 進捗表示) */}
      <View style={[styles.topProgressTrack, { backgroundColor: colors.border }]}>
        <View
          style={[
            styles.topProgressFill,
            { backgroundColor: colors.primary, width: `${sentenceRatio * 100}%` },
          ]}
        />
      </View>

      {/* ブロック 1: 4モード排他セグメントコントロール (D5 / P6) */}
      <View
        style={[
          styles.modeSegmented,
          { backgroundColor: colors.secondarySurface, borderColor: colors.border },
        ]}
      >
        {LESSON_MODES.map((m) => {
          const active = lessonMode === m.key;
          return (
            <Pressable
              key={m.key}
              onPress={() => switchMode(m.key)}
              hitSlop={{ top: 6, bottom: 6 }}
              style={[
                styles.modeSegmentItem,
                active && {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderWidth: 1,
                },
              ]}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${m.label}モード`}
            >
              <ThemedText
                variant="caption"
                color={active ? 'primary' : 'muted'}
                style={styles.modeSegmentLabel}
              >
                {m.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      {/* AB リピート中の簡易バナー (設定中のみ表示) */}
      {ab !== null && lessonMode !== 'speak' ? (
        <View
          style={[
            styles.abBanner,
            { backgroundColor: colors.secondarySurface, borderColor: colors.primary },
          ]}
        >
          <ThemedText variant="caption" color="primary" style={styles.abBannerText} numberOfLines={1}>
            🔁 {abPhrase ? `「${abPhrase}」` : `${formatTime(ab.a)} – ${formatTime(ab.b)}`}
          </ThemedText>
          <Pressable
            onPress={clearAb}
            hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="区間リピートを解除"
          >
            <ThemedText variant="caption" color="primary" style={styles.abClearText}>
              解除
            </ThemedText>
          </Pressable>
        </View>
      ) : null}

      {/* 今日のキーフレーズ (全レッスン統一の焦点表示: 1行コンパクトカード) */}
      {keyPhrase ? (
        <Pressable
          onPress={() => {
            if (keyPhrasePos >= 0) {
              goToPosition(keyPhrasePos, lessonMode !== 'speak');
            }
            const noteIdx = keyPhrase.sentence.linking.findIndex(
              (n) => n.span === keyPhrase.note.span && n.type === keyPhrase.note.type
            );
            setLinkingSheetTarget({
              sentenceIndex: keyPhrase.sentenceIndex,
              noteIndex: noteIdx >= 0 ? noteIdx : 0,
            });
            logEvent('key_phrase_opened', {
              lessonId: lesson.id,
              soundChangeType: keyPhrase.note.type,
            });
          }}
          accessibilityRole="button"
          accessibilityLabel={`今日のキーフレーズ: ${keyPhrase.note.span}（${LINKING_LABELS[keyPhrase.note.type]}）の解説を開く`}
          style={[
            styles.keyPhraseBar,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.keyPhraseLeft}>
            <ThemedText variant="caption" color="muted" style={styles.keyPhraseTag}>
              今日のキーフレーズ
            </ThemedText>
            <View style={styles.keyPhraseMainRow}>
              <ThemedText
                variant="caption"
                style={{
                  color: getLinkingColor(keyPhrase.note.type, scheme),
                  fontWeight: '700',
                }}
              >
                {LINKING_SYMBOLS[keyPhrase.note.type]} {LINKING_LABELS[keyPhrase.note.type]}
              </ThemedText>
              <ThemedText variant="caption" style={styles.keyPhraseSpan} numberOfLines={1}>
                “{keyPhrase.note.span}” {keyPhrase.note.ipa}
              </ThemedText>
            </View>
          </View>
          <ThemedText variant="caption" color="primary" style={styles.keyPhraseAction}>
            解説 ›
          </ThemedText>
        </Pressable>
      ) : null}

      {/* 弱点タイプ克服ガイド (Phase 1-C: ?focus=<type> 指定時のみ表示) */}
      {focusType ? (
        <OvercomingGuideBar
          focusType={focusType}
          completedSteps={overcomingDone}
          currentMode={lessonMode}
          targetSentenceCount={targetSentencePositions.length}
          currentSentenceHasTarget={targetSentencePositions.includes(effectivePos)}
          onSelectStep={(step) => switchMode(step)}
          onJumpToTargetSentence={() => {
            if (targetSentencePositions.length === 0) return;
            const nextPos =
              targetSentencePositions.find((pos) => pos > effectivePos) ??
              targetSentencePositions[0];
            goToPosition(nextPos, statusRef.current.playing);
          }}
        />
      ) : null}

      {/* モード 1: 聞く (カラオケ風表示) */}
      {lessonMode === 'listen' && displaySentence ? (
        <View
          style={[
            styles.stageCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.stageHeader}>
            <ThemedText variant="caption" color="muted" style={styles.speakerLabel}>
              {lesson.speakerNames[displaySentence.speaker] ?? displaySentence.speaker}
            </ThemedText>
            <View style={styles.stageHeaderActions}>
              {legendTypes.length > 0 ? (
                <Pressable
                  onPress={() => setShowLegendSheet(true)}
                  hitSlop={{ top: 14, bottom: 14, left: 6, right: 6 }}
                  accessibilityRole="button"
                  accessibilityLabel="音変化の凡例を開く"
                >
                  <ThemedText variant="caption" color="primary" style={styles.headerActionText}>
                    ? 凡例
                  </ThemedText>
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => toggleWeakSentence(lesson.id, displaySentence.index)}
                hitSlop={{ top: 14, bottom: 14, left: 6, right: 6 }}
                accessibilityRole="button"
                accessibilityLabel={isWeakCurrent ? '苦手フレーズから外す' : '苦手フレーズに登録'}
                accessibilityState={{ selected: isWeakCurrent }}
              >
                <ThemedText
                  variant="caption"
                  style={{
                    color: isWeakCurrent ? weakActiveColor : colors.textMuted,
                    fontWeight: '600',
                  }}
                >
                  {isWeakCurrent ? '★ 苦手' : '☆ 苦手'}
                </ThemedText>
              </Pressable>
            </View>
          </View>

          <View style={styles.stageBody}>
            <KaraokeLine
              sentence={displaySentence}
              activeWordIndex={activeWordIndex}
              onWordPress={(wordIndex) => handleWordPress(displaySentence, wordIndex)}
            />
          </View>

          <ThemedText variant="caption" color="muted" style={styles.translationText}>
            {displaySentence.translationJa}
          </ThemedText>

          {displaySentence.linking.length > 0 ? (
            <Pressable
              onPress={() => {
                const focusNoteIdx = focusType
                  ? displaySentence.linking.findIndex((n) => n.type === focusType)
                  : -1;
                const targetNoteIdx = focusNoteIdx >= 0 ? focusNoteIdx : 0;
                setLinkingSheetTarget({
                  sentenceIndex: displaySentence.index,
                  noteIndex: targetNoteIdx,
                });
                const targetNote = displaySentence.linking[targetNoteIdx];
                if (targetNote) {
                  recordMasteryLinkingNoteOpened(targetNote.type);
                  if (focusType && targetNote.type === focusType) {
                    markOvercomingStep('listen');
                  }
                  logEvent('linking_note_opened', {
                    lessonId: lesson.id,
                    soundChangeType: targetNote.type,
                  });
                }
              }}
              hitSlop={{ top: 8, bottom: 8 }}
              style={[styles.hintRow, { borderTopColor: colors.border }]}
              accessibilityRole="button"
              accessibilityLabel="音の変化の解説を開く"
            >
              <ThemedText variant="caption" color="primary" style={styles.hintRowText}>
                下線の語句をタップで音変化を解説（{displaySentence.linking.length}件）›
              </ThemedText>
            </Pressable>
          ) : (
            <View style={[styles.hintRow, { borderTopColor: colors.border }]}>
              <ThemedText variant="caption" color="muted">
                カラオケ風表示 — 再生すると単語ごとに進みます
              </ThemedText>
            </View>
          )}
        </View>
      ) : null}

      {/* モード 2: 読む (チャンク表示) */}
      {lessonMode === 'read' && displaySentence ? (
        <View
          style={[
            styles.stageCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.stageHeader}>
            <ThemedText variant="caption" color="muted" style={styles.speakerLabel}>
              {lesson.speakerNames[displaySentence.speaker] ?? displaySentence.speaker}
            </ThemedText>
            <View style={styles.stageHeaderActions}>
              <Chip
                label={`訳 ${showChunkJa ? 'ON' : 'OFF'}`}
                active={showChunkJa}
                onPress={toggleChunkJa}
              />
              <Pressable
                onPress={() => toggleWeakSentence(lesson.id, displaySentence.index)}
                hitSlop={{ top: 14, bottom: 14, left: 6, right: 6 }}
                accessibilityRole="button"
                accessibilityLabel={isWeakCurrent ? '苦手フレーズから外す' : '苦手フレーズに登録'}
                accessibilityState={{ selected: isWeakCurrent }}
              >
                <ThemedText
                  variant="caption"
                  style={{
                    color: isWeakCurrent ? weakActiveColor : colors.textMuted,
                    fontWeight: '600',
                  }}
                >
                  {isWeakCurrent ? '★ 苦手' : '☆ 苦手'}
                </ThemedText>
              </Pressable>
            </View>
          </View>

          <View style={styles.stageBody}>
            <ChunkLine
              sentence={displaySentence}
              activeChunkIndex={activeChunkIndex}
              onChunkPress={(chunk) => {
                setFocusedPos(effectivePos);
                seekTo(chunk.startSec, `チャンク「${chunk.text}」へ移動`, () => {
                  if (!statusRef.current.playing) play();
                });
              }}
            />
          </View>

          {showChunkJa ? (
            <ThemedText variant="caption" color="muted" style={styles.translationText}>
              {displaySentence.translationJa}
            </ThemedText>
          ) : (
            <View style={[styles.hintRow, { borderTopColor: colors.border }]}>
              <ThemedText variant="caption" color="muted">
                意味のまとまり（チャンク）をタップするとそこから再生します
              </ThemedText>
            </View>
          )}
        </View>
      ) : null}

      {/* モード 3: 話す (シャドーイング 1文フォーカス) */}
      {lessonMode === 'speak' && displaySentence ? (
        <ShadowingStage
          sentence={displaySentence}
          speakerName={lesson.speakerNames[displaySentence.speaker] ?? displaySentence.speaker}
          isWeak={isWeakCurrent}
          onToggleWeak={() => toggleWeakSentence(lesson.id, displaySentence.index)}
          recordingCount={shadowingCounts[displaySentence.index] ?? 0}
          isRecording={recordingSentence === displaySentence.index}
          recordingElapsedSec={recorder.currentTime}
          isPendingRecord={pendingRecord === displaySentence.index}
          autoRecordAfterModel={autoRecordAfterModel}
          hasUserRecording={Boolean(lastRecordings[displaySentence.index])}
          userRecordingDurationSec={lastRecordings[displaySentence.index]?.durationSec ?? 0}
          comparingSource={
            comparing?.index === displaySentence.index ? comparing.source : null
          }
          isCompareActive={
            comparing?.index === displaySentence.index &&
            (comparing.source === 'user' || modelCompareActive)
          }
          micDenied={micDenied}
          recorderError={
            recorderStatus?.hasError ? (recorderStatus.error ?? '原因不明のエラー') : null
          }
          onPlayModel={() => playModel(displaySentence.index)}
          onPlayUser={() => playUserRecording(displaySentence.index)}
          onCompareSequential={() => compareSequential(displaySentence.index)}
        />
      ) : null}

      {/* モード 4: スクリプト (全文一覧・シーク/リピート専用。R6.3 により他モード部品を残さない) */}
      {lessonMode === 'script' ? (
        <View style={styles.scriptList}>
          <ThemedText variant="caption" color="muted">
            タップで再生位置へ移動・長押しで1文リピートします
          </ThemedText>
          {sentences.map((sentence, pos) => {
            const isActive = pos === effectivePos;
            const isRepeat = repeatSentence === sentence.index;
            const weak = isSentenceWeak(lesson.id, sentence.index);
            return (
              <Pressable
                key={sentence.index}
                ref={(node) => {
                  sentenceCardRefs.current[sentence.index] = node;
                }}
                onPress={() => {
                  setFocusedPos(pos);
                  seekTo(sentence.startSec, `文${pos + 1} 冒頭へ移動`);
                }}
                onLongPress={() => toggleRepeat(sentence.index)}
                accessibilityRole="button"
                accessibilityLabel={`文${pos + 1}: ${sentence.text}${isRepeat ? '（リピート中）' : ''}`}
                accessibilityHint="長押しで1文リピートを設定・解除できます"
                accessibilityState={{ selected: isActive }}
                accessibilityActions={[{ name: 'repeat', label: '1文リピートを切り替え' }]}
                onAccessibilityAction={(e) => {
                  if (e.nativeEvent.actionName === 'repeat') toggleRepeat(sentence.index);
                }}
                style={[
                  styles.scriptCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  (isActive || isRepeat) && { borderColor: colors.primary, borderWidth: 2 },
                ]}
              >
                <View style={styles.scriptCardTop}>
                  <ThemedText variant="caption" color={isActive ? 'primary' : 'muted'}>
                    文{pos + 1} ・ {lesson.speakerNames[sentence.speaker] ?? sentence.speaker}
                    {isRepeat ? ' ・リピート中' : ''}
                  </ThemedText>
                  <Pressable
                    hitSlop={{ top: 14, bottom: 14, left: 6, right: 6 }}
                    onPress={() => toggleWeakSentence(lesson.id, sentence.index)}
                    accessibilityRole="button"
                    accessibilityLabel={weak ? '苦手フレーズから外す' : '苦手フレーズに登録'}
                    accessibilityState={{ selected: weak }}
                  >
                    <ThemedText
                      variant="caption"
                      style={{
                        color: weak ? weakActiveColor : colors.textMuted,
                        fontWeight: '600',
                      }}
                    >
                      {weak ? '★ 苦手' : '☆ 苦手'}
                    </ThemedText>
                  </Pressable>
                </View>
                <ThemedText style={styles.scriptEnglish}>{sentence.text}</ThemedText>
                <ThemedText variant="caption" color="muted">
                  {sentence.translationJa}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {/* 段階開示シート群 (D6 / D7) */}
      <LinkingNoteSheet
        visible={linkingSheetTarget !== null}
        sentence={sheetSentence}
        noteIndex={linkingSheetTarget?.noteIndex ?? 0}
        onSelectNote={(noteIndex) => {
          setLinkingSheetTarget((prev) => (prev ? { ...prev, noteIndex } : null));
          const selectedNote = sheetSentence?.linking[noteIndex];
          if (selectedNote) {
            logEvent('linking_note_opened', {
              lessonId: lesson.id,
              soundChangeType: selectedNote.type,
            });
          }
        }}
        onReplaySentence={() => {
          if (!sheetSentence) return;
          seekTo(sheetSentence.startSec, `解説文再生: 文${sheetSentence.index + 1}`, () => {
            play();
          });
        }}
        onPracticeSpeak={() => {
          if (!sheetSentence) return;
          const pos = sentences.findIndex((s) => s.index === sheetSentence.index);
          if (pos >= 0) goToPosition(pos, false);
          switchMode('speak');
        }}
        onOpenLegend={() => {
          setLinkingSheetTarget(null);
          setShowLegendSheet(true);
        }}
        onClose={() => setLinkingSheetTarget(null)}
      />

      <LegendSheet
        visible={showLegendSheet}
        legendTypes={legendTypes}
        onClose={() => setShowLegendSheet(false)}
      />

      <PlaybackToolsSheet
        visible={showToolsSheet}
        rate={rate}
        onSelectRate={(r) => applyRate(r)}
        ab={ab}
        abPhrase={abPhrase}
        onSetAbPoint={setAbPoint}
        onClearAb={clearAb}
        autoRecordAfterModel={autoRecordAfterModel}
        onToggleAutoRecord={toggleAutoRecord}
        onClose={() => setShowToolsSheet(false)}
      />

      <LessonQuizModal
        key={quizRun}
        visible={showQuiz}
        questions={quizQuestions}
        replaying={quizReplaying}
        onReplay={replayQuizSentence}
        onAnswered={handleQuizAnswered}
        onFinished={() => finishQuiz()}
        onSkip={(answeredCount) => {
          logEvent('lesson_quiz_skipped', { lessonId: lesson.id, answeredCount });
          finishQuiz();
        }}
      />

      <CompletionSummaryModal
        visible={showSummary}
        summarySeconds={summarySeconds}
        shadowingCount={sessionShadowingCount}
        weakCount={sentences.filter((st) => isSentenceWeak(lesson.id, st.index)).length}
        streak={computeStreak(progressDays)}
        todayMinutes={goalStatus.todayMinutes}
        goalMinutes={goalStatus.goalMinutes}
        goalRatio={goalStatus.ratio}
        goalAchieved={goalStatus.achieved}
        isPremium={isPremium}
        hasNextLesson={nextLessonPick !== null}
        focusType={focusType}
        overcomingCompletedSteps={
          focusType
            ? (overcomingDone.listen ? 1 : 0) +
              (overcomingDone.read ? 1 : 0) +
              (overcomingDone.speak ? 1 : 0)
            : undefined
        }
        nextLessonReason={nextLessonPick?.reason ?? null}
        onNextLesson={() => {
          if (!nextLessonPick) return;
          setShowSummary(false);
          router.replace({
            pathname: '/lesson',
            params: {
              lesson: nextLessonPick.item.entry.id,
              ...(focusType ? { focus: focusType } : {}),
            },
          });
        }}
        onOpenPaywall={() => {
          setShowSummary(false);
          router.push('/paywall');
        }}
        onClose={() => setShowSummary(false)}
      />
    </Screen>
  );
}

/**
 * カラオケ風表示の現在文。単語ベースラインが揃うよう単一ラップ構造にしている。
 * アクセシビリティ (E11): 単語を1つずつ読ませず、同じ音変化ノートに属する連続単語と
 * ノートのない連続単語をそれぞれ1セグメントにまとめて読ませる。ノートのセグメントは
 * 「音の変化の解説: <span>」のボタンとして残し、区切り記号「/」は読み上げから外す。
 * 見た目の並び (単語ごとの色・太字・下線) は従来どおり単語単位で維持する。
 */
function KaraokeLine({
  sentence,
  activeWordIndex,
  onWordPress,
}: {
  sentence: LessonSentence;
  activeWordIndex: number;
  onWordPress?: (wordIndex: number) => void;
}) {
  const { scheme, colors } = useTheme();
  const ranges = chunkWordRanges(sentence);
  const linkMap = useMemo(() => wordLinkMap(sentence), [sentence]);

  const renderWord = (word: LessonWord, wordIndex: number) => {
    const isActive = wordIndex === activeWordIndex;
    const isPast = wordIndex < activeWordIndex;
    const noteIndex = linkMap[wordIndex];
    const note =
      noteIndex === null || noteIndex === undefined
        ? undefined
        : sentence.linking[noteIndex];
    const linkColor = note ? getLinkingColor(note.type, scheme) : null;
    const textColor = isActive
      ? colors.primary
      : (linkColor ?? (isPast ? colors.text : colors.textMuted));
    return (
      <ThemedText
        style={[
          styles.karaokeWord,
          { color: textColor },
          isActive && styles.karaokeWordActive,
          linkColor !== null && !isActive && styles.karaokeWordLinked,
          note ? [getLinkingTextDecoration(note.type, scheme), { textDecorationColor: textColor }] : null,
        ]}
      >
        {word.text}
      </ThemedText>
    );
  };

  return (
    <View style={styles.karaokeLine}>
      {ranges.map((range, chunkIdx) => {
        // チャンク内を「同じノートに属する連続単語」「ノートのない連続単語」の
        // セグメントに分割する (読み上げ単位の整理が目的)。
        // 二重 flexWrap による語句縦割れを防ぐため、チャンクは Fragment で展開し、
        // ノートスパンは nowrap、プレーン語群はネスト Text として自然に折り返す。
        const segments: { noteIndex: number | null; from: number; to: number }[] = [];
        for (let wi = range.from; wi < range.to; wi++) {
          const ni = linkMap[wi] ?? null;
          const last = segments[segments.length - 1];
          if (last && last.noteIndex === ni) {
            last.to = wi + 1;
          } else {
            segments.push({ noteIndex: ni, from: wi, to: wi + 1 });
          }
        }
        return (
          <Fragment key={chunkIdx}>
            {segments.map((seg) => {
              const segWords = sentence.words.slice(seg.from, seg.to);
              const note =
                seg.noteIndex === null ? undefined : sentence.linking[seg.noteIndex];
              if (note && onWordPress) {
                return (
                  <Pressable
                    key={`note-${seg.from}`}
                    hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
                    onPress={() => onWordPress(seg.from)}
                    accessibilityRole="button"
                    accessibilityLabel={`音の変化の解説: ${note.span}`}
                    style={styles.karaokeSegment}
                  >
                    {segWords.map((word, i) => (
                      <View key={`${word.text}-${seg.from + i}`}>
                        {renderWord(word, seg.from + i)}
                      </View>
                    ))}
                  </Pressable>
                );
              }
              return (
                <ThemedText
                  key={`plain-${seg.from}`}
                  accessible
                  accessibilityLabel={segWords.map((w) => w.text).join(' ')}
                  style={styles.karaokeWord}
                >
                  {segWords.map((word, i) => {
                    const wi = seg.from + i;
                    const isActive = wi === activeWordIndex;
                    const isPast = wi < activeWordIndex;
                    const textColor = isActive
                      ? colors.primary
                      : isPast
                        ? colors.text
                        : colors.textMuted;
                    return (
                      <Text
                        key={`${word.text}-${wi}`}
                        style={[
                          styles.karaokeWord,
                          { color: textColor },
                          isActive && styles.karaokeWordActive,
                        ]}
                      >
                        {i > 0 ? ' ' : ''}
                        {word.text}
                      </Text>
                    );
                  })}
                </ThemedText>
              );
            })}
            {chunkIdx < ranges.length - 1 ? (
              <ThemedText
                accessibilityElementsHidden
                style={[styles.karaokeWord, { color: colors.textMuted }]}
              >
                /
              </ThemedText>
            ) : null}
          </Fragment>
        );
      })}
    </View>
  );
}

/** チャンク (意味の塊) 表示。タップでそのチャンク冒頭へシーク */
function ChunkLine({
  sentence,
  activeChunkIndex,
  onChunkPress,
}: {
  sentence: LessonSentence;
  activeChunkIndex: number;
  onChunkPress: (chunk: { text: string; startSec: number }) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.chunkRow}>
      {sentence.chunks.map((chunk, i) => {
        const isActive = i === activeChunkIndex;
        return (
          <Pressable
            key={`${chunk.text}-${i}`}
            onPress={() => onChunkPress(chunk)}
            hitSlop={{ top: 4, bottom: 4 }}
            accessibilityRole="button"
            accessibilityLabel={chunk.text}
            accessibilityHint="タップでここから再生"
            accessibilityState={{ selected: isActive }}
            style={[
              styles.chunkBox,
              {
                backgroundColor: colors.secondarySurface,
                borderColor: isActive ? colors.primary : colors.border,
              },
            ]}
          >
            <ThemedText
              style={[styles.chunkWord, isActive && { color: colors.primary, fontWeight: '700' }]}
            >
              {chunk.text}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  topProgressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 12,
  },
  topProgressFill: {
    height: 4,
    borderRadius: 2,
  },
  modeSegmented: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
    gap: 4,
    marginBottom: 16,
  },
  modeSegmentItem: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeSegmentLabel: {
    fontWeight: '700',
  },
  abBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    gap: 8,
  },
  abBannerText: {
    flex: 1,
    fontWeight: '600',
  },
  abClearText: {
    fontWeight: '700',
  },
  keyPhraseBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    gap: 8,
  },
  keyPhraseLeft: {
    flex: 1,
    gap: 2,
  },
  keyPhraseTag: {
    fontWeight: '600',
  },
  keyPhraseMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  keyPhraseSpan: {
    fontWeight: '700',
    flexShrink: 1,
  },
  keyPhraseAction: {
    fontWeight: '700',
  },
  stageCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 16,
  },
  stageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  speakerLabel: {
    fontWeight: '600',
  },
  stageHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerActionText: {
    fontWeight: '600',
  },
  stageBody: {
    minHeight: 120,
    justifyContent: 'center',
    paddingVertical: 4,
  },
  translationText: {
    lineHeight: 20,
  },
  hintRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
  },
  hintRowText: {
    fontWeight: '600',
  },
  karaokeLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 6,
    columnGap: 6,
    alignItems: 'baseline',
  },
  karaokeSegment: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'baseline',
    gap: 6,
  },
  karaokeWord: {
    fontSize: 20,
    lineHeight: 30,
  },
  karaokeWordActive: {
    fontWeight: '700',
  },
  karaokeWordLinked: {
    fontWeight: '600',
  },
  chunkRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chunkBox: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chunkWord: {
    fontSize: 17,
    lineHeight: 24,
  },
  scriptList: {
    gap: 8,
    paddingBottom: 16,
  },
  scriptCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 6,
  },
  scriptCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  scriptEnglish: {
    fontWeight: '500',
  },
  transportBar: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 6,
  },
  seekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  seekTime: {
    minWidth: 34,
    textAlign: 'center',
  },
  seekTrackTouch: {
    flex: 1,
    paddingVertical: 8,
  },
  seekTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  seekFill: {
    height: 6,
    borderRadius: 3,
  },
  transportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  transportTools: {
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 44,
    minWidth: 42,
    justifyContent: 'center',
    alignItems: 'center',
  },
  transportToolsText: {
    fontWeight: '700',
  },
  transportSide: {
    paddingHorizontal: 12,
    borderRadius: 999,
    minHeight: 44,
    minWidth: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  transportRewind: {
    paddingHorizontal: 10,
    borderRadius: 999,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rewindInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  rewindText: {
    fontWeight: '700',
  },
  transportPlay: {
    flex: 1,
    borderRadius: 999,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  playInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  transportDisabled: {
    opacity: 0.4,
  },
  transportMeta: {
    textAlign: 'center',
  },
});

/**
 * ルート: ?lesson=<id>&sentence=<n>&mode=listen|read|speak|script&sheet=linking|tools|legend&focus=<soundType>
 */
export default function LessonRoute() {
  const params = useLocalSearchParams<{
    demo?: string;
    lesson?: string | string[];
    sentence?: string | string[];
    mode?: string | string[];
    sheet?: string | string[];
    autorecord?: string | string[];
    autostudy?: string | string[];
    focus?: string | string[];
  }>();
  const lessonParam = Array.isArray(params.lesson) ? params.lesson[0] : params.lesson;
  const sentenceParam = Array.isArray(params.sentence) ? params.sentence[0] : params.sentence;
  const modeParam = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const sheetParam = Array.isArray(params.sheet) ? params.sheet[0] : params.sheet;
  const focusParam = Array.isArray(params.focus) ? params.focus[0] : params.focus;

  const bundle = getLessonBundle(lessonParam);
  const sentenceNumber = Number.parseInt(sentenceParam ?? '', 10);
  const validModes: LessonMode[] = ['listen', 'read', 'speak', 'script'];
  const initialMode = validModes.includes(modeParam as LessonMode)
    ? (modeParam as LessonMode)
    : null;
  const validSheets = ['linking', 'tools', 'legend'] as const;
  const initialSheet = validSheets.includes(sheetParam as (typeof validSheets)[number])
    ? (sheetParam as 'linking' | 'tools' | 'legend')
    : null;
  const focusType = parseFocusType(focusParam);

  return (
    <LessonPlayerScreen
      key={`${bundle.data.id}-${modeParam ?? ''}-${sheetParam ?? ''}-${sentenceParam ?? ''}-${focusParam ?? ''}`}
      bundle={bundle}
      demoParam={params.demo === '1'}
      initialSentenceIndex={Number.isFinite(sentenceNumber) ? sentenceNumber - 1 : null}
      initialMode={initialMode}
      initialSheet={initialSheet}
      autorecordParam={params.autorecord === '1'}
      autostudyParam={params.autostudy === '1'}
      focusType={focusType}
    />
  );
}
