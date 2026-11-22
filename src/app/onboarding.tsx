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
          // 検証用 deep link (?step=result) の架空の結果は分析ログに記録しない
          if (stepParam !== 'result') {
            logEvent('onboarding_completed', {
            linking_correct: results.filter((r) => r.type === 'linking' && r.correct).length,
            linking_missed: results.filter((r) => r.type === 'linking' && !r.correct).length,
            reduction_correct: results.filter((r) => r.type === 'reduction' && r.correct).length,
            reduction_missed: results.filter((r) => r.type === 'reduction' && !r.correct).length,
            flapping_correct: results.filter((r) => r.type === 'flapping' && r.correct).length,
            flapping_missed: results.filter((r) => r.type === 'flapping' && !r.correct).length,
            });
          }
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

  // 選択肢の表示順を問題ごとに変える (正解が常に先頭に来る固定配置にしない)。
  // 描画の純粋性を保つため、問題内容から決まるシードの決定的シャッフルを使う。
  const shuffledChoices = useMemo(() => {
    const items = question.choices.map((choice, i) => ({ choice, correct: i === 0 }));
    let seed = question.sentenceIndex + 1;
    for (const ch of question.lessonId) {
      seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    }
    seed = (seed + questionIndex * 7919) >>> 0;
    let state = seed >>> 0;
    const nextRandom = () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(nextRandom() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }, [question, questionIndex]);

  // 設問文に正解 (span) を出さないため、文中の該当箇所を空欄に置き換えた表示を作る
  const maskedSentence = useMemo(() => {
    if (!resolved) return null;
    const idx = resolved.text.indexOf(question.span);
    if (idx < 0) return null;
    return {
      before: resolved.text.slice(0, idx),
      after: resolved.text.slice(idx + question.span.length),
    };
  }, [resolved, question]);

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
        correct: shuffledChoices[choiceIndex]?.correct ?? false,
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
    <Screen
      footer={
        answered !== null ? (
          <View
            style={[
              styles.footerBar,
              { backgroundColor: colors.surface, borderTopColor: colors.border },
            ]}
          >
            <Pressable
              style={[
                styles.primaryButton,
                styles.footerButton,
                { backgroundColor: colors.primary },
              ]}
              onPress={next}
            >
              <ThemedText style={{ color: colors.primaryText, fontWeight: '700' }}>
                {questionIndex + 1 < DIAGNOSTIC_QUESTIONS.length ? '次の問題へ' : '結果を見る'}
              </ThemedText>
            </Pressable>
          </View>
        ) : undefined
      }
    >
      <ThemedText variant="caption" color="muted">
        診断 {questionIndex + 1} / {DIAGNOSTIC_QUESTIONS.length}
      </ThemedText>
      <ThemedText variant="heading">音声を聞いて、何と聞こえたか答えてください</ThemedText>

      <Pressable
        style={[
          styles.playButton,
          answered === null
            ? { backgroundColor: colors.primary }
            : {
                backgroundColor: colors.surface,
                borderColor: colors.primary,
                borderWidth: 1,
              },
        ]}
        onPress={playSegment}
      >
        <ThemedText
          style={{
            color: answered === null ? colors.primaryText : colors.primary,
            fontWeight: '700',
          }}
        >
          {playing ? '▶ 再生中…' : answered === null ? '▶ 音声を再生する' : '↻ もう一度再生する'}
        </ThemedText>
      </Pressable>

      {maskedSentence ? (
        <ThemedText style={styles.maskedSentence}>
          {maskedSentence.before}
          <ThemedText style={{ color: colors.primary, fontWeight: '700' }}>＿＿＿＿</ThemedText>
          {maskedSentence.after}
        </ThemedText>
      ) : null}
      <ThemedText variant="heading" style={styles.questionTitle}>
        空欄の部分は何と聞こえた？
      </ThemedText>
      {shuffledChoices.map((item, i) => {
        const choice = item.choice;
        const isCorrect = item.correct;
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
              showState && isCorrect && { borderColor: colors.success, borderWidth: 2 },
              showState && isSelected && !isCorrect && { borderColor: colors.danger, borderWidth: 2 },
            ]}
          >
            <ThemedText
              style={
                showState && isCorrect
                  ? { color: colors.success, fontWeight: '700' }
                  : showState && isSelected && !isCorrect
                    ? { color: colors.danger, fontWeight: '600' }
                    : undefined
              }
            >
              {showState && isCorrect ? '✓ ' : showState && isSelected ? '✗ ' : ''}
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
  footerBar: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  footerButton: { marginTop: 0 },
  playButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  questionTitle: { marginTop: 12 },
  maskedSentence: { marginTop: 16, lineHeight: 24 },
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
    padding: 16,
    gap: 8,
    marginTop: 12,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 8,
    marginTop: 12,
  },
  missedRow: { flexDirection: 'row', justifyContent: 'space-between' },
  gap: { marginTop: 4 },
});
