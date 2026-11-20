import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { type ComponentRef } from 'react';
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
import { useLocalSearchParams } from 'expo-router';

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
import { getLessonBundle, type LessonBundle } from '@/features/lesson/registry';
import {
  LINKING_COLORS,
  LINKING_LABELS,
  wordLinkMap,
} from '@/features/lesson/linkingViz';
import type { LessonLinkingNote, LessonSentence } from '@/features/lesson/types';
import { ControlButton, formatTime } from '@/features/player/shared';
import {
  getPlayerPrefs,
  setPlayerPrefsDisplayMode,
  setPlayerPrefsRate,
  togglePlayerPrefsChunkJa,
  type ChunkDisplayMode,
} from '@/features/player/playerPrefs';
import {
  addShadowingCount,
  getShadowingCounts,
  lessonShadowingTotal,
} from '@/features/player/shadowingStore';
import { useTheme } from '@/theme/AppThemeProvider';

/**
 * パイプライン生成レッスンのプレイヤー (カラオケ表示・文シーク・文リピート)。
 * 再生ロジックの基本型はオーディオスパイク画面 (src/app/spike.tsx) で検証済みのものを使う。
 */

/** チャンクごとの単語インデックス範囲 (パイプラインが台本トークンを順に消費して作るため 1:1) */
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

function LessonPlayerScreen({
  bundle,
  demoParam,
  initialSentenceIndex,
  autorecordParam,
}: {
  bundle: LessonBundle;
  demoParam: boolean;
  /** 深い位置の文へ自動スクロールする (deep link の ?sentence=<n>) */
  initialSentenceIndex: number | null;
  /** 自動録音デモ (スクロール後に録音開始 → 4 秒で停止) */
  autorecordParam: boolean;
}) {
  const lesson = bundle.data;
  const { colors } = useTheme();
  const prefs = getPlayerPrefs();
  const [rate, setRate] = useState<PlaybackRate>(prefs.rate);
  const [repeatSentence, setRepeatSentence] = useState<number | null>(null);
  // 表示モード (カラオケ / チャンク) とチャンク直訳トグル。アプリ再起動まで保持
  const [displayMode, setDisplayModeState] = useState<ChunkDisplayMode>(prefs.displayMode);
  const [showChunkJa, setShowChunkJaState] = useState(prefs.showChunkJa);
  // AB リピート区間 (任意の開始点 A・終了点 B)
  const [ab, setAb] = useState<{ a: number; b: number } | null>(null);
  // タップした音の変化の詳細 (どの文のどの注釈か)
  const [noteDetail, setNoteDetail] = useState<{ sentenceIndex: number; noteIndex: number } | null>(
    null
  );

  const setDisplayMode = (mode: ChunkDisplayMode) => {
    setDisplayModeState(mode);
    setPlayerPrefsDisplayMode(mode);
  };
  const toggleChunkJa = () => {
    setShowChunkJaState(togglePlayerPrefsChunkJa());
  };

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {
      // スパイク画面と異なりロック画面は使わないため、失敗しても再生は継続する
    });
  }, []);

  const player = useAudioPlayer(bundle.audio, {
    updateInterval: STATUS_UPDATE_INTERVAL_MILLIS,
  });
  const status = useAudioPlayerStatus(player);
  // 保存済みの速度を新しい player にも適用する (player は 1.0 で初期化されるため)
  const rateAppliedRef = useRef(false);
  useEffect(() => {
    if (rateAppliedRef.current || prefs.rate === 1.0) return;
    rateAppliedRef.current = true;
    player.setPlaybackRate(prefs.rate, PITCH_CORRECTION_QUALITY);
    // player 生成時に一度だけ適用する (以降の速度変更は applyRate 経由)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player]);

  const sentences = lesson.sentences;

  // 画面内ログ = 実証エビデンス (Metro コンソールにも出力)。id はレンダーの鍵として安定させる
  const [log, setLog] = useState<{ id: number; text: string }[]>([]);
  const logIdRef = useRef(0);
  const append = (action: string) => {
    const at = new Date().toLocaleTimeString('ja-JP', { hour12: false });
    logIdRef.current += 1;
    const id = logIdRef.current;
    setLog((prev) => [{ id, text: `${at}  ${action}` }, ...prev].slice(0, 8));
    if (__DEV__) console.log(`[lesson] ${at} ${action}`);
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
        // シーク失敗は再生位置を変えないだけで致命的ではないが、
        // 失敗時の後処理 (ガード解除など) は必ず実行する
        append(`seekTo(${clamped}) 失敗`);
        onFail?.();
      });
  };

  // --- 手動操作とデモが共用する操作関数 (ログはここで一度だけ記録する) ---
  const manuallyPausedRef = useRef(false);
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
  };
  const togglePlay = () => {
    if (status.playing) {
      pause();
    } else if (
      repeatSentence === null &&
      (status.didJustFinish || (status.duration > 0 && status.currentTime >= status.duration - 0.05))
    ) {
      seekTo(0, 'seekTo(0) // 終端から先頭へ', () => play());
    } else {
      play();
    }
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

  // --- AB リピート (任意の開始点 A・終了点 B を現在位置に設定) ---
  // デモの setTimeout から呼ばれても最新の再生位置を使えるよう status を ref にミラーする
  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);
  const setAbPoint = (which: 'a' | 'b') => {
    const now = statusRef.current.currentTime;
    const duration = statusRef.current.duration || lesson.durationSec;
    setAb((prev) => {
      const a = which === 'a' ? now : (prev?.a ?? Math.max(0, now - 3));
      const b = which === 'b' ? now : (prev?.b ?? Math.min(duration, now + 3));
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      // 同一位置タップによるゼロ長区間は B 到達判定との無限シークループになるため拒否
      return hi - lo > 0.2 ? { a: lo, b: hi } : (prev ?? null);
    });
    append(`AB: ${which.toUpperCase()} = ${now.toFixed(2)}s 設定`);
  };
  const clearAb = () => {
    setAb(null);
    append('AB リピート解除');
  };

  // --- シャドーイング録音と比較再生 (Issue #10) ---
  // 録音は端末内のみ (GM 決定: 外部送信は一切しない)。ファイルはキャッシュ領域に置き、
  // レッスンを離れたら破棄する。録音回数 (文ごと / レッスンごと) はアプリ再起動まで保持。
  const [recordingSentence, setRecordingSentence] = useState<number | null>(null);
  const [recorderStatus, setRecorderStatus] = useState<RecordingStatus | null>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY, (recStatus) =>
    setRecorderStatus(recStatus)
  );
  const [micDenied, setMicDenied] = useState(false);
  const [lastRecordings, setLastRecordings] = useState<
    Record<number, { uri: string; durationSec: number }>
  >({});
  const [shadowingCounts, setShadowingCounts] = useState<Record<number, number>>(() =>
    getShadowingCounts(lesson.id)
  );
  const [comparing, setComparing] = useState<{ index: number; source: 'model' | 'user' } | null>(
    null
  );
  const userAudioRef = useRef<AudioPlayer | null>(null);
  const lastRecordingsRef = useRef(lastRecordings);
  useEffect(() => {
    lastRecordingsRef.current = lastRecordings;
  }, [lastRecordings]);

  const startRecording = async (sentenceIndex: number) => {
    // 録音中はレッスン音声・比較再生と競合しないよう止める (GM 決定)
    player.pause();
    userAudioRef.current?.pause();
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setMicDenied(true);
      append('マイク権限が拒否されています');
      return;
    }
    setMicDenied(false);
    try {
      // iOS で録音するには allowsRecording: true が必要 (停止後に解除してスピーカー再生に戻す)
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      recorder.record();
      setRecordingSentence(sentenceIndex);
      append(`録音開始: 文${sentenceIndex + 1}`);
    } catch {
      append('録音の開始に失敗しました');
    }
  };

  const stopRecording = (sentenceIndex: number) => {
    try {
      recorder.stop();
    } catch {
      append('録音の停止に失敗しました');
      setRecordingSentence(null);
      return;
    }
    const duration = recorder.currentTime;
    const uri = recorder.uri;
    setRecordingSentence(null);
    void setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
    if (!uri) {
      append('録音ファイルを取得できませんでした');
      return;
    }
    setLastRecordings((prev) => ({ ...prev, [sentenceIndex]: { uri, durationSec: duration } }));
    setShadowingCounts(addShadowingCount(lesson.id, sentenceIndex));
    append(`録音完了: 文${sentenceIndex + 1} ${duration.toFixed(1)} 秒`);
  };

  // お手本 = 該当文の区間再生 (レッスン音声)。文の終端で自動停止する
  const playModel = (sentenceIndex: number) => {
    const sentence = sentences.find((s) => s.index === sentenceIndex);
    if (!sentence) return;
    userAudioRef.current?.pause();
    setComparing({ index: sentenceIndex, source: 'model' });
    seekTo(sentence.startSec, `お手本再生: 文${sentenceIndex + 1}`, () => play());
  };

  const playUserRecording = (sentenceIndex: number) => {
    const rec = lastRecordings[sentenceIndex];
    if (!rec) return;
    player.pause();
    userAudioRef.current?.release();
    userAudioRef.current = createAudioPlayer(rec.uri);
    userAudioRef.current.play();
    setComparing({ index: sentenceIndex, source: 'user' });
    append(`自分の録音を再生: 文${sentenceIndex + 1} (${rec.durationSec.toFixed(1)} 秒)`);
  };

  // レッスンを離れたら録音プレイヤーとキャッシュ内の録音ファイルを破棄する (GM 決定)
  useEffect(() => {
    return () => {
      userAudioRef.current?.release();
      userAudioRef.current = null;
      for (const rec of Object.values(lastRecordingsRef.current)) {
        if (rec.uri.startsWith('file://')) {
          void deleteAsync(rec.uri, { idempotent: true }).catch(() => {});
        }
      }
    };
  }, []);

  // ?demo=1: 再生→速度変更→文シーク→カラオケ確認→停止を自動実行
  // (手動操作と同じ操作関数を呼ぶ。ログは操作関数側で一度だけ記録される)
  const demoRanRef = useRef(false);
  useEffect(() => {
    if (!demoParam || demoRanRef.current) return;
    demoRanRef.current = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (delayMs: number, fn: () => void) => {
      timers.push(setTimeout(fn, delayMs));
    };
    append('--- 自動デモ開始 (?demo=1) ---');
    at(500, () => play('play()'));
    at(2500, () => applyRate(1.15, 'setPlaybackRate(1.15, high) // ピッチ補正あり'));
    at(4500, () => applyRate(1.0, 'setPlaybackRate(1.0, high)'));
    at(5500, () => {
      const s3 = sentences.find((s) => s.index === 2);
      if (!s3) return;
      seekTo(s3.startSec, `seekTo(${s3.startSec}) // 文3の冒頭へ (文シーク)`);
    });
    at(7000, () => setAbPoint('a'));
    at(8500, () => setAbPoint('b'));
    at(10000, () => pause('pause() // デモ終了'));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoParam, player]);

  // ?autorecord=1: 自動スクロール後に録音を開始し、4 秒で自動停止する
  // (シミュレータでの録音フロー自動検証用。手動操作と同じ startRecording / stopRecording を呼ぶ)
  const autoRecordRanRef = useRef(false);
  useEffect(() => {
    if (!autorecordParam || autoRecordRanRef.current) return;
    autoRecordRanRef.current = true;
    const target = initialSentenceIndex ?? 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (delayMs: number, fn: () => void) => {
      timers.push(setTimeout(fn, delayMs));
    };
    at(1800, () => void startRecording(target));
    at(6800, () => stopRecording(target));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autorecordParam]);

  // 文リピート (スパイク画面と同じ終端判定)。シーク先込み中の重複発行をガードし、
  // 完了時には「リピートがまだ有効か」を ref で確認してから再開する
  // (シーク完了前に解除された古い操作からは再生を始めない)
  const seekingRef = useRef(false);
  const repeatSentenceRef = useRef<number | null>(null);
  const abRef = useRef<{ a: number; b: number } | null>(null);
  useEffect(() => {
    repeatSentenceRef.current = repeatSentence;
  }, [repeatSentence]);
  useEffect(() => {
    abRef.current = ab;
  }, [ab]);
  // AB リピート (文リピートより優先。両方設定時は AB 区間を繰り返す)
  useEffect(() => {
    if (ab === null || seekingRef.current) return;
    if (status.didJustFinish || status.currentTime >= ab.b - 0.05) {
      seekingRef.current = true;
      seekTo(
        ab.a,
        `AB リピート: ${ab.a.toFixed(2)}s へ戻す`,
        () => {
          seekingRef.current = false;
          // 自然終了は再生を再開する。シーク中の手動一時停止は尊重して再開しない
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
  useEffect(() => {
    if (repeatSentence === null || ab !== null) return;
    const sentence = sentences.find((s) => s.index === repeatSentence);
    if (!sentence) return;
    const endThreshold =
      status.duration > 0 ? Math.min(sentence.endSec, status.duration - 0.05) : sentence.endSec;
    if (seekingRef.current) return;
    if (status.didJustFinish || status.currentTime >= endThreshold) {
      seekingRef.current = true;
      // シーク発行時の再生状態を記録しておき、完了時にそれを優先する
      // (シーク中のユーザーの一時停止を上書きしない)
      const wasPlaying = status.playing;
      seekTo(
        sentence.startSec,
        `文リピート: ${sentence.startSec.toFixed(2)}s へ戻す`,
        () => {
          seekingRef.current = false;
          if (wasPlaying && repeatSentenceRef.current === sentence.index) {
            play();
          }
        },
        () => {
          // シーク失敗でもガードは必ず解除する (リピートが永久停止しないように)
          seekingRef.current = false;
        }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.currentTime, status.playing, status.didJustFinish, status.duration, repeatSentence]);

  // カラオケ表示: 現在文と現在単語を再生位置から導出
  const t = status.currentTime;
  const activeSentence = useMemo(
    () => sentences.find((s) => t >= s.startSec && t < s.endSec) ?? null,
    [sentences, t]
  );
  const activeWordIndex = useMemo(() => {
    if (!activeSentence) return -1;
    return activeSentence.words.findIndex((w) => t >= w.startSec && t < w.endSec);
  }, [activeSentence, t]);
  // お手本の区間再生: 文の終端に来たら一時停止して比較再生を止める
  useEffect(() => {
    if (comparing?.source !== 'model') return;
    const sentence = sentences.find((s) => s.index === comparing.index);
    if (!sentence) return;
    if (t >= sentence.endSec) {
      player.pause();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comparing, t]);
  // このレッスンに登場する音の変化の種類 (凡例表示用)
  const legendTypes = useMemo(() => {
    const set = new Set<LessonLinkingNote['type']>();
    for (const s of sentences) {
      for (const n of s.linking) {
        set.add(n.type);
      }
    }
    return [...set];
  }, [sentences]);

  // 単語タップ → その単語に重なる音の変化の詳細を表示
  const handleWordPress = (sentence: LessonSentence, wordIndex: number) => {
    const noteIndex = wordLinkMap(sentence)[wordIndex];
    if (noteIndex === null || noteIndex === undefined) return;
    const note = sentence.linking[noteIndex];
    if (!note) return;
    setNoteDetail({ sentenceIndex: sentence.index, noteIndex });
    append(`音の変化: ${note.span} (${LINKING_LABELS[note.type]})`);
  };

  const progress = status.duration > 0 ? Math.min(1, status.currentTime / status.duration) : 0;

  // ?sentence=<n> 指定時: 該当文カードまで自動スクロールする (録音導線のショートカット)
  const scrollRef = useRef<ComponentRef<typeof ScrollView> | null>(null);
  const sentenceCardRefs = useRef<
    Record<number, { measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => void } | null>
  >({});
  const autoScrolledRef = useRef(false);
  useEffect(() => {
    if (initialSentenceIndex === null || autoScrolledRef.current) return;
    const timer = setTimeout(() => {
      const card = sentenceCardRefs.current[initialSentenceIndex];
      if (!card) return;
      card.measureInWindow((x: number, y: number, _w: number, _h: number) => {
        scrollRef.current?.scrollTo({ y: Math.max(y - 200, 0), animated: true });
        autoScrolledRef.current = true;
      });
    }, 1200);
    return () => clearTimeout(timer);
  }, [initialSentenceIndex]);

  return (
    <Screen scrollRef={scrollRef}>
      <ThemedText variant="caption" color="muted">
        パイプライン生成レッスン (Google Cloud TTS Neural2 + faster-whisper)
      </ThemedText>

      <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <ThemedText variant="heading">{lesson.title}</ThemedText>
        <ThemedText variant="caption" color="muted">
          {lesson.titleJa} ・ {lesson.durationSec.toFixed(1)} 秒 / {sentences.length} 文 ・
          config {lesson.configHash.slice(0, 8)}
        </ThemedText>

        <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
          <View
            style={[styles.progressFill, { backgroundColor: colors.primary, width: `${progress * 100}%` }]}
          />
        </View>
        <ThemedText variant="caption" color="muted">
          {formatTime(status.currentTime)} / {formatTime(status.duration)} ・ rate=
          {status.playbackRate.toFixed(2)}
        </ThemedText>

        <View style={styles.controlsRow}>
          <ControlButton label={status.playing ? '⏸ 一時停止' : '▶ 再生'} primary onPress={togglePlay} />
        </View>
        <View style={styles.rateRow}>
          {PLAYBACK_RATES.map((r) => (
            <Chip key={r} label={`${r}x`} active={rate === r} onPress={() => applyRate(r)} />
          ))}
        </View>
        <View style={styles.abRow}>
          <Chip
            label={`A ${ab ? ab.a.toFixed(1) : '–'}`}
            active={ab !== null}
            onPress={() => setAbPoint('a')}
          />
          <Chip
            label={`B ${ab ? ab.b.toFixed(1) : '–'}`}
            active={ab !== null}
            onPress={() => setAbPoint('b')}
          />
          {ab !== null ? <Chip label="解除" onPress={clearAb} /> : null}
          <ThemedText variant="caption" color="muted">
            区間リピート (現在位置を A / B に設定)
          </ThemedText>
        </View>
      </View>

      {/* 表示モード: カラオケ (単語ハイライト) / チャンク (意味の塊 + 直訳トグル) */}
      <View style={styles.displayRow}>
        <Chip
          label="カラオケ"
          active={displayMode === 'karaoke'}
          onPress={() => setDisplayMode('karaoke')}
        />
        <Chip
          label="チャンク"
          active={displayMode === 'chunks'}
          onPress={() => setDisplayMode('chunks')}
        />
        {displayMode === 'chunks' ? (
          <Chip label={`直訳 ${showChunkJa ? 'ON' : 'OFF'}`} active={showChunkJa} onPress={toggleChunkJa} />
        ) : null}
      </View>

      {/* 音の変化の凡例 (このレッスンに登場する種類だけ) */}
      {legendTypes.length > 0 ? (
        <View style={styles.legendRow}>
          {legendTypes.map((type) => (
            <View key={type} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: LINKING_COLORS[type] }]} />
              <ThemedText variant="caption" color="muted">
                {LINKING_LABELS[type]}
              </ThemedText>
            </View>
          ))}
        </View>
      ) : null}

      {/* 表示: カラオケ (単語ハイライト + 音の変化の色分け) またはチャンク (意味の塊) */}
      <ThemedText variant="heading" style={styles.sectionTitle}>
        {displayMode === 'karaoke' ? 'カラオケ表示 (現在文)' : 'チャンク表示 (現在文)'}
      </ThemedText>
      {activeSentence ? (
        <View style={[styles.karaoke, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ThemedText variant="caption" color="muted">
            {lesson.speakerNames[activeSentence.speaker] ?? activeSentence.speaker}
          </ThemedText>
          {displayMode === 'karaoke' ? (
            <KaraokeLine
              sentence={activeSentence}
              activeWordIndex={activeWordIndex}
              onWordPress={(wordIndex) => handleWordPress(activeSentence, wordIndex)}
            />
          ) : (
            <ChunkLine
              sentence={activeSentence}
              onChunkPress={(chunk) =>
                seekTo(chunk.startSec, `seekTo(${chunk.startSec}) // チャンク「${chunk.text}」`)
              }
            />
          )}
          {(displayMode === 'karaoke' || showChunkJa) ? (
            <ThemedText variant="caption" color="muted">
              {activeSentence.translationJa}
            </ThemedText>
          ) : null}
          {/* タップした音の変化の詳細 */}
          {noteDetail && activeSentence.index === noteDetail.sentenceIndex ? (
            (() => {
              const note = activeSentence.linking[noteDetail.noteIndex];
              if (!note) return null;
              return (
                <View
                  style={[
                    styles.noteDetail,
                    { borderLeftColor: LINKING_COLORS[note.type] },
                  ]}
                >
                  <ThemedText variant="caption" style={{ color: LINKING_COLORS[note.type], fontWeight: '700' }}>
                    {LINKING_LABELS[note.type]} ・ {note.span} {note.ipa}
                  </ThemedText>
                  <ThemedText variant="caption" color="muted">
                    {note.noteJa}
                  </ThemedText>
                </View>
              );
            })()
          ) : null}
          {displayMode === 'karaoke' && activeSentence.linking.length > 0 ? (
            <View style={styles.linkingBox}>
              {activeSentence.linking.map((note, noteIndex) => (
                <Pressable
                  key={`${noteIndex}-${note.span}`}
                  onPress={() =>
                    setNoteDetail({ sentenceIndex: activeSentence.index, noteIndex })
                  }
                >
                  <ThemedText
                    variant="caption"
                    style={{
                      color: noteDetail?.sentenceIndex === activeSentence.index &&
                        noteDetail?.noteIndex === noteIndex
                        ? LINKING_COLORS[note.type]
                        : undefined,
                      fontWeight:
                        noteDetail?.sentenceIndex === activeSentence.index &&
                        noteDetail?.noteIndex === noteIndex
                          ? '700'
                          : undefined,
                    }}
                  >
                    <ThemedText color="muted">🔗 </ThemedText>
                    {note.span} {note.ipa} — {note.noteJa}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      ) : (
        <ThemedText variant="caption" color="muted">
          再生すると現在の文がここに表示されます (タップで文ジャンプ)
        </ThemedText>
      )}

      <ThemedText variant="heading" style={styles.sectionTitle}>
        シャドーイング (録音して比較再生 ・ 合計 {lessonShadowingTotal(lesson.id)} 回)
      </ThemedText>
      <ThemedText variant="caption" color="muted">
        文の 🎙 録音 → 🔊 お手本 / 🎤 自分の録音 で聞き比べ。録音は端末内にのみ保存され、
        レッスンを離れると破棄されます (このレッスンの録音合計:{' '}
        {lessonShadowingTotal(lesson.id)} 回)
      </ThemedText>
      {micDenied ? (
        <ThemedText variant="caption" style={styles.micDeniedText}>
          マイク権限が拒否されています。iOS 設定 &gt; プライバシーとセキュリティ &gt; マイク
          でこのアプリを許可すると録音できます。
        </ThemedText>
      ) : null}
      {recorderStatus?.hasError ? (
        <ThemedText variant="caption" style={styles.micDeniedText}>
          録音中にエラーが発生しました: {recorderStatus.error ?? '原因不明のエラー'}
        </ThemedText>
      ) : null}
      <ThemedText variant="heading" style={styles.sectionTitle}>
        スクリプト (タップで冒頭へシーク ・ 長押しでリピート)
      </ThemedText>
      {sentences.map((sentence) => (
        <Pressable
          key={sentence.index}
          ref={(node) => {
            sentenceCardRefs.current[sentence.index] = node;
          }}
          onPress={() =>
            seekTo(sentence.startSec, `seekTo(${sentence.startSec}) // 文${sentence.index + 1} 冒頭`)
          }
          onLongPress={() => toggleRepeat(sentence.index)}
          style={[
            styles.sentence,
            { backgroundColor: colors.surface, borderColor: colors.border },
            activeSentence?.index === sentence.index && { borderColor: colors.primary, borderWidth: 2 },
            repeatSentence === sentence.index && { borderColor: colors.primary, borderWidth: 2 },
          ]}
        >
          <ThemedText variant="caption" color="muted">
            文{sentence.index + 1} ・ {lesson.speakerNames[sentence.speaker] ?? sentence.speaker} ・
            [{sentence.startSec.toFixed(2)}s]
            {repeatSentence === sentence.index ? ' ・リピート中' : ''}
          </ThemedText>
          <ThemedText>{sentence.text}</ThemedText>
          <ThemedText variant="caption" color="muted">
            {sentence.translationJa}
          </ThemedText>
          {/* シャドーイング録音と比較再生 (Issue #10)。録音は端末内のみ */}
          <View style={styles.shadowingRow}>
            {recordingSentence === sentence.index ? (
              <Pressable
                onPress={() => stopRecording(sentence.index)}
                style={[styles.shadowingButton, { backgroundColor: colors.secondarySurface }]}
              >
                <ThemedText variant="caption" style={styles.recordingText}>
                  ⏹ 録音停止 ({recorder.currentTime.toFixed(1)} 秒)
                </ThemedText>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => startRecording(sentence.index)}
                style={[styles.shadowingButton, { backgroundColor: colors.secondarySurface }]}
              >
                <ThemedText variant="caption">
                  🎙 録音{lastRecordings[sentence.index] ? ' (録り直す)' : ''}
                </ThemedText>
              </Pressable>
            )}
            <Pressable
              onPress={() => playModel(sentence.index)}
              disabled={comparing?.index === sentence.index && comparing.source === 'model'}
              style={[
                styles.shadowingButton,
                { backgroundColor: colors.secondarySurface },
                comparing?.index === sentence.index &&
                  comparing.source === 'model' && { opacity: 0.5 },
              ]}
            >
              <ThemedText variant="caption">🔊 お手本</ThemedText>
            </Pressable>
            {lastRecordings[sentence.index] ? (
              <Pressable
                onPress={() => playUserRecording(sentence.index)}
                disabled={comparing?.index === sentence.index && comparing.source === 'user'}
                style={[
                  styles.shadowingButton,
                  { backgroundColor: colors.secondarySurface },
                  comparing?.index === sentence.index &&
                    comparing.source === 'user' && { opacity: 0.5 },
                ]}
              >
                <ThemedText variant="caption">🎤 自分の録音</ThemedText>
              </Pressable>
            ) : null}
            {shadowingCounts[sentence.index] ? (
              <ThemedText variant="caption" color="muted">
                録音 {shadowingCounts[sentence.index]} 回
              </ThemedText>
            ) : null}
          </View>
        </Pressable>
      ))}

      <ThemedText variant="heading" style={styles.sectionTitle}>
        アクションログ
      </ThemedText>
      <View style={[styles.logPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {log.length === 0 ? (
          <ThemedText variant="caption" color="muted">
            操作するとここにログが記録されます
          </ThemedText>
        ) : (
          log.map((entry) => (
            <ThemedText key={entry.id} variant="caption">
              {entry.text}
            </ThemedText>
          ))
        )}
      </View>
    </Screen>
  );
}

/** 現在文の単語ハイライト表示。チャンク境界にスラッシュ、音の変化箇所は色分け + タップで詳細 */
function KaraokeLine({
  sentence,
  activeWordIndex,
  onWordPress,
}: {
  sentence: LessonSentence;
  activeWordIndex: number;
  onWordPress?: (wordIndex: number) => void;
}) {
  const { colors } = useTheme();
  const ranges = chunkWordRanges(sentence);
  const linkMap = useMemo(() => wordLinkMap(sentence), [sentence]);
  return (
    <View style={styles.karaokeLine}>
      {ranges.map((range, chunkIdx) => (
        <View key={chunkIdx} style={styles.karaokeChunk}>
          {sentence.words.slice(range.from, range.to).map((word, i) => {
            const wordIndex = range.from + i;
            const isActive = wordIndex === activeWordIndex;
            const isPast = wordIndex < activeWordIndex;
            const noteIndex = linkMap[wordIndex];
            // linkMap は text トークン基準のため words と長さがずれると undefined になり得る
            const note =
              noteIndex === null || noteIndex === undefined
                ? undefined
                : sentence.linking[noteIndex];
            const linkColor = note ? LINKING_COLORS[note.type] : null;
            const wordNode = (
              <ThemedText
                style={[
                  styles.karaokeWord,
                  { color: isActive ? colors.primary : linkColor ?? (isPast ? colors.text : colors.textMuted) },
                  isActive && styles.karaokeWordActive,
                  linkColor !== null && !isActive && styles.karaokeWordLinked,
                ]}
              >
                {word.text}
              </ThemedText>
            );
            return note && onWordPress ? (
              <Pressable
                key={`${word.text}-${wordIndex}`}
                hitSlop={4}
                onPress={() => onWordPress(wordIndex)}
              >
                {wordNode}
              </Pressable>
            ) : (
              <ThemedText key={`${word.text}-${wordIndex}`}>{wordNode}</ThemedText>
            );
          })}
          {chunkIdx < ranges.length - 1 ? (
            <ThemedText style={[styles.karaokeWord, { color: colors.textMuted }]}> / </ThemedText>
          ) : null}
        </View>
      ))}
    </View>
  );
}

/** チャンク (意味の塊) 表示。タップでチャンクの冒頭へシーク */
function ChunkLine({
  sentence,
  onChunkPress,
}: {
  sentence: LessonSentence;
  onChunkPress: (chunk: { text: string; startSec: number }) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.chunkRow}>
      {sentence.chunks.map((chunk, i) => (
        <Pressable
          key={`${chunk.text}-${i}`}
          onPress={() => onChunkPress(chunk)}
          style={[styles.chunkBox, { backgroundColor: colors.secondarySurface }]}
        >
          <ThemedText style={styles.karaokeWord}>{chunk.text}</ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: { height: 6, borderRadius: 3 },
  controlsRow: { flexDirection: 'row', gap: 8 },
  rateRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  sectionTitle: { marginTop: 18 },
  karaoke: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    gap: 6,
  },
  karaokeLine: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  karaokeChunk: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5 },
  karaokeWord: { fontSize: 16, lineHeight: 24 },
  karaokeWordActive: { fontWeight: '700' },
  karaokeWordLinked: { fontWeight: '600', textDecorationLine: 'underline' },
  chunkRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chunkBox: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  abRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  displayRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  noteDetail: {
    borderLeftWidth: 3,
    paddingLeft: 8,
    gap: 2,
    marginTop: 4,
  },
  linkingBox: { marginTop: 4, gap: 2 },
  shadowingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  shadowingButton: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  recordingText: { color: '#DC2626', fontWeight: '700' },
  micDeniedText: { color: '#DC2626', marginTop: 4 },
  sentence: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    gap: 4,
  },
  logPanel: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    gap: 4,
  },
});

/** ルート: ?lesson=<id>&sentence=<n>&autorecord=1&demo=1 で対象文を選択 (既定は cafe-ordering)。
 *  autorecord=1 は自動スクロール後に録音を開始して数秒で停止する
 *  (自動検証用。?demo=1 と同じく既存の操作関数を呼ぶだけ) */
export default function LessonRoute() {
  const params = useLocalSearchParams<{
    demo?: string;
    lesson?: string | string[];
    sentence?: string | string[];
    autorecord?: string | string[];
  }>();
  const lessonParam = Array.isArray(params.lesson) ? params.lesson[0] : params.lesson;
  const sentenceParam = Array.isArray(params.sentence) ? params.sentence[0] : params.sentence;
  const bundle = getLessonBundle(lessonParam);
  const sentenceNumber = Number.parseInt(sentenceParam ?? '', 10);
  return (
    <LessonPlayerScreen
      key={bundle.data.id}
      bundle={bundle}
      demoParam={params.demo === '1'}
      initialSentenceIndex={Number.isFinite(sentenceNumber) ? sentenceNumber - 1 : null}
      autorecordParam={params.autorecord === '1'}
    />
  );
}
