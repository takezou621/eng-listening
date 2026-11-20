import { useEffect, useRef, useState } from 'react';
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
import { SPIKE_SAMPLE } from '@/features/spike/sample';
import { useTheme } from '@/theme/AppThemeProvider';

type LogEntry = { at: string; action: string };

/** 画面内アクティビティログ = スパイク実証のエビデンス (PR 説明に転記する) */
function useSpikeLog() {
  const [log, setLog] = useState<LogEntry[]>([]);
  const append = (action: string) => {
    const at = new Date().toLocaleTimeString('ja-JP', { hour12: false });
    setLog((prev) => [{ at, action }, ...prev].slice(0, 12));
    // Metro コンソールにも出力 (自動検証時のテキスト記録用)
    if (__DEV__) console.log(`[spike] ${at} ${action}`);
  };
  return { log, append };
}

function formatTime(seconds: number): string {
  const s = Math.max(0, seconds);
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
}

export default function AudioSpikeScreen() {
  const { colors } = useTheme();
  const { log, append } = useSpikeLog();
  const [rate, setRate] = useState<PlaybackRate>(1.0);
  const [lockScreenActive, setLockScreenActive] = useState(false);
  const [repeatSentence, setRepeatSentence] = useState<number | null>(null);

  // ロック画面コントロールには doNotMix + バックグラウンド再生が必要 (expo-audio の仕様)
  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'doNotMix',
      shouldPlayInBackground: true,
    })
      .then(() => append('setAudioModeAsync: doNotMix / shouldPlayInBackground=true'))
      .catch((e: unknown) => append(`setAudioModeAsync 失敗: ${String(e)}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const player = useAudioPlayer(SPIKE_SAMPLE.asset, {
    // expo-audio の updateInterval はミリ秒単位 (秒ではない)
    updateInterval: STATUS_UPDATE_INTERVAL_MILLIS,
  });

  // 画面を離れたらロック画面のコントロールを解除 (player 解放の前に実行される)
  useEffect(() => {
    return () => {
      player.clearLockScreenControls();
    };
  }, [player]);

  const status = useAudioPlayerStatus(player);

  const seekTo = (seconds: number, label: string) => {
    const clamped = Math.min(Math.max(seconds, 0), status.duration || SPIKE_SAMPLE.durationSec);
    player
      .seekTo(clamped, SEEK_TOLERANCE_MILLIS, SEEK_TOLERANCE_MILLIS)
      .then(() => append(label))
      .catch((e: unknown) => append(`seekTo(${clamped}) 失敗: ${String(e)}`));
  };

  // ?demo=1: 再生→速度変更→文シーク→ロック画面有効化を自動実行する
  // (シミュレータの自動検証・エビデンス取得用。手動操作と同じ API を順に呼ぶだけ)
  const demoRanRef = useRef(false);
  const params = useLocalSearchParams<{ demo?: string }>();
  useEffect(() => {
    if (params.demo !== '1' || demoRanRef.current) return;
    demoRanRef.current = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (delayMs: number, fn: () => void) => {
      timers.push(setTimeout(fn, delayMs));
    };
    append('--- 自動デモ開始 (?demo=1) ---');
    at(500, () => {
      player.play();
      append('play()');
    });
    at(2500, () => {
      player.setPlaybackRate(0.7, PITCH_CORRECTION_QUALITY);
      setRate(0.7);
      append('setPlaybackRate(0.7, high) // ピッチ補正あり');
    });
    at(4500, () => {
      player.setPlaybackRate(1.2, PITCH_CORRECTION_QUALITY);
      setRate(1.2);
      append('setPlaybackRate(1.2, high) // ピッチ補正あり');
    });
    at(6500, () => {
      const sentence3 = SPIKE_SAMPLE.sentences.find((s) => s.index === 2);
      if (!sentence3) return;
      seekTo(sentence3.startSec, `seekTo(${sentence3.startSec}) // 文3の冒頭へ (文単位ジャンプ)`);
    });
    at(7500, () => {
      player.setPlaybackRate(1.0, PITCH_CORRECTION_QUALITY);
      setRate(1.0);
      append('setPlaybackRate(1.0, high)');
    });
    at(8500, () => {
      player.setActiveForLockScreen(
        true,
        { title: SPIKE_SAMPLE.title, artist: SPIKE_SAMPLE.artist, albumTitle: 'Audio Spike' },
        {
          showSeekForward: true,
          showSeekBackward: true,
          seekForwardIntervalSeconds: 5,
          seekBackwardIntervalSeconds: 5,
        }
      );
      setLockScreenActive(true);
      append('setActiveForLockScreen(true, metadata, seek±5s)');
    });
    at(9500, () => {
      player.pause();
      append('pause() // デモ終了');
    });
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.demo, player]);

  const togglePlay = () => {
    if (status.playing) {
      player.pause();
      append('pause()');
    } else if (status.didJustFinish) {
      // 終端で停止している場合: iOS は再生位置を先頭へ戻さないため seekTo(0) してから再生
      player
        .seekTo(0, SEEK_TOLERANCE_MILLIS, SEEK_TOLERANCE_MILLIS)
        .then(() => {
          player.play();
          append('seekTo(0) + play() // 終端からの再再生');
        })
        .catch((e: unknown) => append(`再再生失敗: ${String(e)}`));
    } else {
      player.play();
      append('play()');
    }
  };

  const applyRate = (nextRate: PlaybackRate) => {
    setRate(nextRate);
    player.setPlaybackRate(nextRate, PITCH_CORRECTION_QUALITY);
    append(`setPlaybackRate(${nextRate}, ${PITCH_CORRECTION_QUALITY})  // ピッチ補正あり`);
  };

  const toggleLockScreen = () => {
    if (lockScreenActive) {
      player.clearLockScreenControls();
      setLockScreenActive(false);
      append('clearLockScreenControls()');
    } else {
      player.setActiveForLockScreen(
        true,
        { title: SPIKE_SAMPLE.title, artist: SPIKE_SAMPLE.artist, albumTitle: 'Audio Spike' },
        {
          showSeekForward: true,
          showSeekBackward: true,
          seekForwardIntervalSeconds: 5,
          seekBackwardIntervalSeconds: 5,
        }
      );
      setLockScreenActive(true);
      append('setActiveForLockScreen(true, metadata, seek±5s)');
    }
  };

  // 文リピート (ABリピートの土台): 選択文の終端に来たら開始位置へ戻す。
  // 最終文は endSec == duration で再生が先に終わるため didJustFinish も見る
  useEffect(() => {
    if (repeatSentence === null) return;
    const sentence = SPIKE_SAMPLE.sentences.find((s) => s.index === repeatSentence);
    if (!sentence) return;
    const endThreshold =
      status.duration > 0 ? Math.min(sentence.endSec, status.duration - 0.05) : sentence.endSec;
    const shouldRepeat = status.didJustFinish || status.currentTime >= endThreshold;
    if (shouldRepeat) {
      player
        .seekTo(sentence.startSec, SEEK_TOLERANCE_MILLIS, SEEK_TOLERANCE_MILLIS)
        .then(() => {
          if (!status.playing) player.play();
          append(`文リピート: ${sentence.startSec.toFixed(2)}s へ戻す`);
        })
        .catch((e: unknown) => append(`文リピート失敗: ${String(e)}`));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.currentTime, status.playing, status.didJustFinish, status.duration, repeatSentence]);

  const progress =
    status.duration > 0 ? Math.min(1, status.currentTime / status.duration) : 0;

  return (
    <Screen>
      <ThemedText variant="caption" color="muted">
        スパイク: 単一速度トラック + アプリ内速度変更 / 文単位シーク / ロック画面コントロール
      </ThemedText>

      <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <ThemedText variant="heading">{SPIKE_SAMPLE.title}</ThemedText>
        <ThemedText variant="caption" color="muted">
          {SPIKE_SAMPLE.durationSec.toFixed(2)} 秒 / {SPIKE_SAMPLE.sentences.length} 文
          (say + ffmpeg で生成したサンプル音声をバンドル)
        </ThemedText>

        <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
          <View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${progress * 100}%` }]} />
        </View>
        <ThemedText variant="caption" color="muted">
          {formatTime(status.currentTime)} / {formatTime(status.duration)} ・{' '}
          {status.playing ? '再生中' : '停止中'} ・ rate={status.playbackRate.toFixed(2)}
          {status.shouldCorrectPitch ? ' (ピッチ補正ON)' : ''}
        </ThemedText>

        <View style={styles.controlsRow}>
          <ControlButton label="⏪ 5s" onPress={() => seekTo(status.currentTime - 5, 'seekTo(now-5)')} />
          <ControlButton label={status.playing ? '⏸ 一時停止' : '▶ 再生'} primary onPress={togglePlay} />
          <ControlButton label="⏩ 5s" onPress={() => seekTo(status.currentTime + 5, 'seekTo(now+5)')} />
        </View>
        <ControlButton
          label={lockScreenActive ? 'ロック画面コントロール解除' : 'ロック画面コントロールを有効化'}
          onPress={toggleLockScreen}
        />
      </View>

      <ThemedText variant="heading" style={styles.sectionTitle}>
        速度変更 (ピッチ補正 {PITCH_CORRECTION_QUALITY})
      </ThemedText>
      <View style={styles.rateRow}>
        {PLAYBACK_RATES.map((r) => (
          <Chip key={r} label={`${r}x`} active={rate === r} onPress={() => applyRate(r)} />
        ))}
      </View>

      <ThemedText variant="heading" style={styles.sectionTitle}>
        文単位ジャンプ (タップで冒頭へシーク) ・ 長押しでリピート
      </ThemedText>
      {SPIKE_SAMPLE.sentences.map((sentence) => (
        <Pressable
          key={sentence.index}
          onPress={() => seekTo(sentence.startSec, `seekTo(文${sentence.index + 1} 冒頭 ${sentence.startSec.toFixed(2)}s)`)}
          onLongPress={() => {
            setRepeatSentence(repeatSentence === sentence.index ? null : sentence.index);
            append(
              repeatSentence === sentence.index
                ? `文${sentence.index + 1} リピート解除`
                : `文${sentence.index + 1} リピート開始`
            );
          }}
          style={[
            styles.sentence,
            { backgroundColor: colors.surface, borderColor: colors.border },
            repeatSentence === sentence.index && { borderColor: colors.primary, borderWidth: 2 },
          ]}
        >
          <ThemedText variant="caption" color="muted">
            文{sentence.index + 1} [{sentence.startSec.toFixed(2)}s – {sentence.endSec.toFixed(2)}s]
            {repeatSentence === sentence.index ? ' ・リピート中' : ''}
          </ThemedText>
          <ThemedText>{sentence.text}</ThemedText>
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
          log.map((entry, i) => (
            <ThemedText key={`${entry.at}-${i}`} variant="caption">
              {entry.at}  {entry.action}
            </ThemedText>
          ))
        )}
      </View>

      <ThemedText variant="caption" color="muted" style={styles.note}>
        ロック画面コントロール: 有効化後にシミュレータ/実機をロックすると、再生・一時停止・±5秒シークが
        ロック画面とコントロールセンターから操作できます。
      </ThemedText>
    </Screen>
  );
}

function ControlButton({
  label,
  onPress,
  primary = false,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.controlButton,
        primary
          ? { backgroundColor: colors.primary }
          : { backgroundColor: colors.secondarySurface },
      ]}
    >
      <ThemedText style={{ color: primary ? colors.primaryText : colors.text, fontWeight: '600' }}>
        {label}
      </ThemedText>
    </Pressable>
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
  controlButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  sectionTitle: { marginTop: 18 },
  rateRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
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
  note: { marginTop: 16 },
});
