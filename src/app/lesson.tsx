import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from 'expo-audio';
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

function LessonPlayerScreen({ bundle, demoParam }: { bundle: LessonBundle; demoParam: boolean }) {
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
  const play = (label = 'play()') => {
    player.play();
    append(label);
  };
  const pause = (label = 'pause()') => {
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
      const wasPlaying = status.playing;
      seekTo(
        ab.a,
        `AB リピート: ${ab.a.toFixed(2)}s へ戻す`,
        () => {
          seekingRef.current = false;
          if (wasPlaying && abRef.current !== null) {
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

  return (
    <Screen>
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
        スクリプト (タップで冒頭へシーク ・ 長押しでリピート)
      </ThemedText>
      {sentences.map((sentence) => (
        <Pressable
          key={sentence.index}
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

/** ルート: ?lesson=<id>&demo=1 でレッスンを選択 (既定は cafe-ordering) */
export default function LessonRoute() {
  const params = useLocalSearchParams<{ demo?: string; lesson?: string | string[] }>();
  const lessonParam = Array.isArray(params.lesson) ? params.lesson[0] : params.lesson;
  const bundle = getLessonBundle(lessonParam);
  return (
    <LessonPlayerScreen
      key={bundle.data.id}
      bundle={bundle}
      demoParam={params.demo === '1'}
    />
  );
}
