import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SEEK_TOLERANCE_MILLIS } from '@/config/appConfig';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import {
  DIAGNOSTIC_QUESTIONS,
  countMissedTypes,
  pickRecommendedLesson,
  resolveQuestionData,
  type DiagnosticResult,
} from '@/features/onboarding/diagnostic';
import { getLessonList } from '@/features/lesson/registry';
import { useUserData } from '@/features/library/userStore';
import { logEvent } from '@/features/analytics/analyticsStore';
import { useTheme } from '@/theme/AppThemeProvider';

/**
 * 初回オンボーディング診断 (60 秒 Aha Moment)。
 * 「単語は知っているのに聞き取れない理由が見える」体験を 3 問で届け、
 * 弱点に合うレッスンへつなぐ。スキップは常時表示 (強制しない)。
 * 実施結果は端末内にのみ保存し、外部送信はしない。
 */

type Phase = 'intro' | 'question' | 'feedback' | 'result';

export default function OnboardingScreen() {
  const params = useLocalSearchParams<{ step?: string | string[] }>();
  const stepParam = Array.isArray(params.step) ? params.step[0] : params.step;
  const router = useRouter();
  const { colors } = useTheme();
  const { completeOnboarding } = useUserData();

  const questions = DIAGNOSTIC_QUESTIONS;
  // ?step=result / ?step=questions で指定フェーズから開始できる (検証用 deep link)。
  // params はマウント後に不変のため、初期状態として直接使う (effect は不要)
  const initialPhase: Phase =
    stepParam === 'result' ? 'result' : stepParam === 'questions' ? 'question' : 'intro';
  const initialResults: DiagnosticResult[] =
    stepParam === 'result'
      ? questions.map((q, i) => ({
          type: q.type,
          span: q.span,
          correct: i !== 1, // 1 問だけ不正解にして内訳の表示を検証する
        }))
      : [];
  const [phase, setPhase] = useState<Phase>(initialPhase);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [results, setResults] = useState<DiagnosticResult[]>(initialResults);

  const finish = () => {
    completeOnboarding();
    router.replace('/(tabs)');
  };

  const skip = () => {
    logEvent('onboarding_skipped');
    completeOnboarding();
    router.replace('/(tabs)');
  };

  if (phase === 'intro') {
    return (
      <Screen>
        <ThemedText variant="title">はじめての 60 秒診断</ThemedText>
        <ThemedText variant="caption" color="muted" style={styles.subtitle}>
          3 つの音声を聞いて、「何と聞こえたか」に答えるだけ。
          単語は知っているのに聞き取れない理由が、ここで見えます。
        </ThemedText>
        <Pressable
          style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          onPress={() => {
            logEvent('onboarding_started');
            setPhase('question');
          }}
        >
          <ThemedText style={{ color: colors.primaryText, fontWeight: '700' }}>
            診断をはじめる (約 60 秒)
          </ThemedText>
        </Pressable>
        <Pressable onPress={skip} style={styles.skipButton}>
          <ThemedText variant="caption" color="muted">
            スキップしてライブラリへ
          </ThemedText>
        </Pressable>
      </Screen>
    );
  }

  if (phase === 'result') {
    return (
      <ResultScreen
        results={results}
        onFinish={() => {
          logEvent('onboarding_completed', {
            linking_correct: results.filter((r) => r.type === 'linking' && r.correct).length,
            linking_missed: results.filter((r) => r.type === 'linking' && !r.correct).length,
            reduction_correct: results.filter((r) => r.type === 'reduction' && r.correct).length,
            reduction_missed: results.filter((r) => r.type === 'reduction' && !r.correct).length,
            flapping_correct: results.filter((r) => r.type === 'flapping' && r.correct).length,
            flapping_missed: results.filter((r) => r.type === 'flapping' && !r.correct).length,
          });
          finish();
        }}
      />
    );
  }

  return (
    <QuestionPhase
      questionIndex={questionIndex}
      setQuestionIndex={setQuestionIndex}
      results={results}
      setResults={setResults}
      setPhase={setPhase}
      onSkip={skip}
    />
  );
}

// ---------------------------------------------------------------------------

function QuestionPhase({
  questionIndex,
  setQuestionIndex,
  results,
  setResults,
  setPhase,
  onSkip,
}: {
  questionIndex: number;
  setQuestionIndex: (i: number) => void;
  results: DiagnosticResult[];
  setResults: (r: DiagnosticResult[]) => void;
  setPhase: (p: 'intro' | 'question' | 'feedback' | 'result') => void;
  onSkip: () => void;
}) {
  const { colors } = useTheme();
  const question = DIAGNOSTIC_QUESTIONS[questionIndex];
  const resolved = useMemo(() => resolveQuestionData(question), [question]);
  const [answered, setAnswered] = useState<number | null>(null);

  // 区間再生: 文の startSec から再生し、endSec を超えたら一時停止する
  const player = useAudioPlayer(resolved ? resolved.bundle.audio : undefined);
  const status = useAudioPlayerStatus(player);
  const playing = status.playing;

  const playSegment = () => {
    if (!resolved) return;
    // seekTo は非同期のため、完了後に play する (文頭からの区間再生を保証する)
    player
      .seekTo(resolved.startSec, SEEK_TOLERANCE_MILLIS, SEEK_TOLERANCE_MILLIS)
      .then(() => player.play())
      .catch(() => {
        player.seekTo(resolved.startSec);
        player.play();
      });
  };

  useEffect(() => {
    if (!resolved) return;
    if (status.currentTime >= resolved.endSec) {
      player.pause();
    }
  }, [resolved, status.currentTime, player]);

  const answer = (choiceIndex: number) => {
    if (answered !== null) return;
    setAnswered(choiceIndex);
    setResults([
      ...results,
      {
        type: question.type,
        span: question.span,
        correct: choiceIndex === 0,
      },
    ]);
  };

  const next = () => {
    if (questionIndex + 1 < DIAGNOSTIC_QUESTIONS.length) {
      setQuestionIndex(questionIndex + 1);
      setAnswered(null);
      setPhase('question');
    } else {
      setPhase('result');
    }
  };

  if (!resolved || !resolved.note) {
    // レッスンデータが取れない場合は次へ (通常起動では発生しない)
    return (
      <Screen>
        <ThemedText>この問題は表示できません。</ThemedText>
      </Screen>
    );
  }

  return (
    <Screen>
      <ThemedText variant="caption" color="muted">
        診断 {questionIndex + 1} / {DIAGNOSTIC_QUESTIONS.length}
      </ThemedText>
      <ThemedText variant="heading">音声を聞いて、何と聞こえたか答えてください</ThemedText>

      <Pressable style={[styles.playButton, { backgroundColor: colors.primary }]} onPress={playSegment}>
        <ThemedText style={{ color: colors.primaryText, fontWeight: '700' }}>
          {playing ? '▶ 再生中…' : '▶ 音声を再生する'}
        </ThemedText>
      </Pressable>
      {answered !== null ? (
        <Pressable onPress={playSegment}>
          <ThemedText variant="caption" color="primary">
            ↻ もう一度再生する
          </ThemedText>
        </Pressable>
      ) : null}

      <ThemedText variant="heading" style={styles.questionTitle}>
        「{question.span}」の部分は何と聞こえた？
      </ThemedText>
      {question.choices.map((choice, i) => {
        const isCorrect = i === 0;
        const isSelected = answered === i;
        const showState = answered !== null;
        return (
          <Pressable
            key={choice}
            onPress={() => answer(i)}
            disabled={answered !== null}
            style={[
              styles.choiceButton,
              { backgroundColor: colors.surface, borderColor: colors.border },
              showState && isCorrect && { borderColor: '#16A34A', borderWidth: 2 },
              showState && isSelected && !isCorrect && { borderColor: '#DC2626', borderWidth: 2 },
            ]}
          >
            <ThemedText style={{ color: showState && isCorrect ? '#16A34A' : undefined }}>
              {choice}
            </ThemedText>
          </Pressable>
        );
      })}

      {answered !== null ? (
        <View style={[styles.explainCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ThemedText variant="heading">正解は「{question.choices[0]}」</ThemedText>
          <ThemedText variant="caption" color="muted">
            {resolved.text}
          </ThemedText>
          <ThemedText variant="caption" color="muted">
            {resolved.note.span} {resolved.note.ipa} — {resolved.note.noteJa}
          </ThemedText>
          <Pressable onPress={playSegment}>
            <ThemedText variant="caption" color="primary">
              ↻ もう一度再生する
            </ThemedText>
          </Pressable>
          <Pressable style={[styles.primaryButton, { backgroundColor: colors.primary }]} onPress={next}>
            <ThemedText style={{ color: colors.primaryText, fontWeight: '700' }}>
              {questionIndex + 1 < DIAGNOSTIC_QUESTIONS.length ? '次の問題へ' : '結果を見る'}
            </ThemedText>
          </Pressable>
        </View>
      ) : null}
      <Pressable onPress={onSkip} style={styles.skipButton}>
        <ThemedText variant="caption" color="muted">
          スキップしてライブラリへ
        </ThemedText>
      </Pressable>
    </Screen>
  );
}

// ---------------------------------------------------------------------------

function ResultScreen({ results, onFinish }: { results: DiagnosticResult[]; onFinish: () => void }) {
  const { colors } = useTheme();
  const router = useRouter();
  const missed = countMissedTypes(results);
  const missedTypes = Object.keys(missed);
  const recommendation = pickRecommendedLesson(
    missed,
    getLessonList().map((l) => l.bundle).filter((b): b is NonNullable<typeof b> => b !== null)
  );
  const LABELS: Record<string, string> = {
    linking: 'リンキング',
    reduction: 'リダクション',
    flapping: 'フラッピング',
    assimilation: '同化',
    palatalization: '口蓋化',
    elision: '脱落',
    intrusion: '侵入',
    'weak-form': '弱形',
  };

  return (
    <Screen>
      <ThemedText variant="title">診断結果</ThemedText>
      <ThemedText variant="caption" color="muted" style={styles.subtitle}>
        {results.filter((r) => !r.correct).length > 0
          ? '聞き取れなかった音の変化はここにあります。単語は知っているのに、音の変化で聞こえなくなっています。'
          : 'すべて正解です。音の変化を聞き取れています。ライブラリからレッスンを選びましょう。'}
      </ThemedText>

      {missedTypes.length > 0 ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ThemedText variant="heading">聞き取れなかった音の変化</ThemedText>
          {Object.entries(missed).map(([type, count]) => (
            <View key={type} style={styles.missedRow}>
              <ThemedText>{LABELS[type] ?? type}</ThemedText>
              <ThemedText variant="caption" color="muted">
                {count} 件
              </ThemedText>
            </View>
          ))}
        </View>
      ) : null}

      {recommendation ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ThemedText variant="caption" color="muted">
            あなたにおすすめのレッスン
          </ThemedText>
          <ThemedText variant="heading">{recommendation.title}</ThemedText>
          <ThemedText variant="caption" color="muted">
            {recommendation.titleJa}
          </ThemedText>
          <ThemedText variant="caption" color="muted" style={styles.gap}>
            {recommendation.reason}
          </ThemedText>
          <Pressable
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            onPress={() => {
              onFinish(); // 診断完了を記録してからレッスンへ遷移する (再表示防止)
              router.push(`/lesson?lesson=${recommendation.lessonId}`);
            }}
          >
            <ThemedText style={{ color: colors.primaryText, fontWeight: '700' }}>
              このレッスンをはじめる
            </ThemedText>
          </Pressable>
        </View>
      ) : null}

      <Pressable onPress={onFinish} style={styles.skipButton}>
        <ThemedText variant="caption" color="muted">
          ライブラリへ進む
        </ThemedText>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: { marginTop: 4, marginBottom: 16 },
  primaryButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  skipButton: { alignItems: 'center', marginTop: 16, padding: 8 },
  playButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  questionTitle: { marginTop: 16 },
  choiceButton: {
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  explainCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 6,
    marginTop: 12,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 8,
    marginTop: 12,
  },
  missedRow: { flexDirection: 'row', justifyContent: 'space-between' },
  gap: { marginTop: 4 },
});
