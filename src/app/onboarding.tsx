import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SEEK_TOLERANCE_MILLIS } from '@/config/appConfig';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { SymbolView } from 'expo-symbols';

import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import {
  DIAGNOSTIC_QUESTIONS,
  countMissedTypes,
  pickRecommendedLesson,
  resolveQuestionData,
  type DiagnosticResult,
} from '@/features/onboarding/diagnostic';
import {
  LINKING_LABELS,
  LINKING_TEXT_DECORATIONS,
  getLinkingColor,
} from '@/features/lesson/linkingViz';
import { buildPersonalCurriculum } from '@/features/learning/curriculum';
import { getLessonList } from '@/features/lesson/registry';
import { useUserData } from '@/features/library/userStore';
import { logEvent } from '@/features/analytics/analyticsStore';
import { setGa4UserProperties } from '@/features/analytics/ga4';
import { useTheme } from '@/theme/AppThemeProvider';

/**
 * 初回オンボーディング診断 (60 秒 Aha Moment)。
 * 「単語は知っているのに聞き取れない理由が見える」体験を 3 問で届け、
 * 弱点に合うレッスンと苦手フレーズ自動登録へつなぐ。スキップは常時表示 (強制しない)。
 * 実施結果は端末内にのみ保存し、外部送信はしない。
 */

type Phase = 'intro' | 'question' | 'feedback' | 'result';

export default function OnboardingScreen() {
  const params = useLocalSearchParams<{ step?: string | string[]; perfect?: string | string[] }>();
  const stepParam = Array.isArray(params.step) ? params.step[0] : params.step;
  const perfectParam = Array.isArray(params.perfect) ? params.perfect[0] : params.perfect;
  const router = useRouter();
  const { colors } = useTheme();
  const { completeOnboarding, addWeakSentencesFromDiagnostic, saveDiagnosticProfile } = useUserData();

  const questions = DIAGNOSTIC_QUESTIONS;
  // ?step=result / ?step=questions で指定フェーズから開始できる (検証用 deep link)。
  // params はマウント後に不変のため、初期状態として直接使う (effect は不要)
  const initialPhase: Phase =
    stepParam === 'result' ? 'result' : stepParam === 'questions' ? 'question' : 'intro';
  const initialResults: DiagnosticResult[] =
    stepParam === 'result'
      ? questions.map((q, i) => ({
          lessonId: q.lessonId,
          sentenceIndex: q.sentenceIndex,
          type: q.type,
          span: q.span,
          correct: perfectParam === '1' ? true : i !== 1,
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
        <View style={styles.introHero}>
          <View style={[styles.heroBadge, { backgroundColor: colors.secondarySurface }]}>
            <SymbolView
              name="waveform"
              size={28}
              tintColor={colors.primary}
              type="monochrome"
              resizeMode="scaleAspectFit"
              fallback={<ThemedText style={{ fontSize: 24 }}>🎧</ThemedText>}
            />
          </View>
          <ThemedText variant="title">はじめての 60 秒診断</ThemedText>
          <ThemedText variant="caption" color="muted" style={styles.subtitle}>
            3 つの音声を聞いて、「何と聞こえたか」に答えるだけ。
            単語は知っているのに聞き取れない理由が、ここで見えます。
          </ThemedText>
        </View>

        <View
          style={[
            styles.card,
            styles.introPointsCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.introPointRow}>
            <ThemedText
              variant="caption"
              color="primary"
              style={[styles.introPointBadge, { backgroundColor: colors.secondarySurface }]}
            >
              1
            </ThemedText>
            <ThemedText variant="caption">全 3 問・約 60 秒で音の変化をチェック</ThemedText>
          </View>
          <View style={styles.introPointRow}>
            <ThemedText
              variant="caption"
              color="primary"
              style={[styles.introPointBadge, { backgroundColor: colors.secondarySurface }]}
            >
              2
            </ThemedText>
            <ThemedText variant="caption">つまずいた種類を見える化＆おすすめ提案</ThemedText>
          </View>
          <View style={styles.introPointRow}>
            <ThemedText
              variant="caption"
              color="primary"
              style={[styles.introPointBadge, { backgroundColor: colors.secondarySurface }]}
            >
              3
            </ThemedText>
            <ThemedText variant="caption">結果は端末内にのみ保存（登録不要）</ThemedText>
          </View>
        </View>

        <Pressable
          style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          accessibilityRole="button"
          onPress={() => {
            logEvent('onboarding_started');
            setPhase('question');
          }}
        >
          <ThemedText style={{ color: colors.primaryText, fontWeight: '700' }}>
            診断をはじめる (約 60 秒)
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={skip}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          style={styles.skipButton}
        >
          <ThemedText variant="caption" color="muted">
            スキップしてライブラリへ
          </ThemedText>
        </Pressable>
      </Screen>
    );
  }

  if (phase === 'result') {
    const commitDiagnosticResult = (recommendedLessonId: string | null) => {
      // 検証用 deep link (?step=result) の架空の結果は分析ログ・苦手フレーズへ記録しない
      if (stepParam !== 'result') {
        const missedItems = results
          .filter((r) => !r.correct)
          .map((r) => ({ lessonId: r.lessonId, sentenceIndex: r.sentenceIndex }));
        addWeakSentencesFromDiagnostic(missedItems);

        const missedMap = countMissedTypes(results);
        const score = results.filter((r) => r.correct).length;
        saveDiagnosticProfile({
          completedAtMs: Date.now(),
          score,
          total: results.length,
          missedTypes: missedMap,
          recommendedLessonId,
        });

        const level = score >= 3 ? 'advanced' : score === 2 ? 'intermediate' : 'beginner';
        logEvent('onboarding_completed', {
          linking_correct: results.filter((r) => r.type === 'linking' && r.correct).length,
          linking_missed: results.filter((r) => r.type === 'linking' && !r.correct).length,
          reduction_correct: results.filter((r) => r.type === 'reduction' && r.correct).length,
          reduction_missed: results.filter((r) => r.type === 'reduction' && !r.correct).length,
          flapping_correct: results.filter((r) => r.type === 'flapping' && r.correct).length,
          flapping_missed: results.filter((r) => r.type === 'flapping' && !r.correct).length,
          score,
          level,
        });
        setGa4UserProperties({ diagnostic_level: level });
      }
      finish();
    };
    return (
      <ResultScreen
        results={results}
        onFinish={commitDiagnosticResult}
      />
    );
  }

  return (
    <QuestionPhase
      key={questionIndex}
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
  const { scheme, colors } = useTheme();
  const question = DIAGNOSTIC_QUESTIONS[questionIndex];
  const resolved = useMemo(() => resolveQuestionData(question), [question]);
  const [answered, setAnswered] = useState<number | null>(null);

  // 選択肢の表示順を問題ごとに変える (正解が常に先頭に来る固定配置にしない: W8)。
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

  // 設問文に正解 (span) を出さないため、文中の該当箇所を空欄に置き換えた表示を作る (W8)
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
    const isCorrect = shuffledChoices[choiceIndex]?.correct ?? false;
    logEvent('diagnostic_answered', {
      questionIndex,
      correct: isCorrect,
      soundChangeType: question.type,
    });
    setResults([
      ...results,
      {
        lessonId: question.lessonId,
        sentenceIndex: question.sentenceIndex,
        type: question.type,
        span: question.span,
        correct: isCorrect,
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

  const progressRatio = (questionIndex + 1) / DIAGNOSTIC_QUESTIONS.length;
  const noteColor = getLinkingColor(question.type, scheme);

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
              accessibilityRole="button"
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
      <View style={styles.progressHeader}>
        <ThemedText variant="caption" color="muted">
          診断 {questionIndex + 1} / {DIAGNOSTIC_QUESTIONS.length}
        </ThemedText>
        <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.progressFill,
              { backgroundColor: colors.primary, width: `${progressRatio * 100}%` },
            ]}
          />
        </View>
      </View>

      <ThemedText variant="heading" style={styles.questionTitle}>
        音声を聞いて、空欄の部分を選んでください
      </ThemedText>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          playing ? '音声を再生中' : answered === null ? '音声を再生する' : 'もう一度再生する'
        }
        accessibilityState={{ busy: playing }}
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
        <View
          style={[
            styles.sentenceCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <ThemedText style={styles.maskedSentence}>
            {maskedSentence.before}
            <ThemedText style={{ color: colors.primary, fontWeight: '700' }}>＿＿＿＿</ThemedText>
            {maskedSentence.after}
          </ThemedText>
        </View>
      ) : null}

      <View style={styles.choicesList}>
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
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected, disabled: answered !== null }}
              accessibilityLabel={
                showState
                  ? isCorrect
                    ? `${choice}（正解）`
                    : isSelected
                      ? `${choice}（不正解）`
                      : choice
                  : choice
              }
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
      </View>

      {answered !== null ? (
        <View
          style={[
            styles.explainCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.explainTopRow}>
            <ThemedText variant="heading">正解は「{question.choices[0]}」</ThemedText>
            <View style={[styles.typeBadge, { backgroundColor: colors.secondarySurface }]}>
              <ThemedText
                variant="caption"
                style={[
                  styles.typeBadgeText,
                  { color: noteColor, textDecorationColor: noteColor },
                  LINKING_TEXT_DECORATIONS[question.type],
                ]}
              >
                {LINKING_LABELS[question.type]}
              </ThemedText>
            </View>
          </View>
          <ThemedText variant="caption" color="muted">
            {resolved.text}
          </ThemedText>
          <ThemedText variant="caption" color="muted">
            {resolved.note.span} {resolved.note.ipa} — {resolved.note.noteJa}
          </ThemedText>
        </View>
      ) : null}

      <Pressable
        onPress={onSkip}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        style={styles.skipButton}
      >
        <ThemedText variant="caption" color="muted">
          スキップしてライブラリへ
        </ThemedText>
      </Pressable>
    </Screen>
  );
}

// ---------------------------------------------------------------------------

function ResultScreen({
  results,
  onFinish,
}: {
  results: DiagnosticResult[];
  onFinish: (recommendedLessonId: string | null) => void;
}) {
  const { scheme, colors } = useTheme();
  const router = useRouter();
  const missed = countMissedTypes(results);
  const totalCount = Math.max(results.length, 1);
  const correctCount = results.filter((r) => r.correct).length;
  const missedCount = results.length - correctCount;
  const scoreRatio = correctCount / totalCount;
  const allCorrect = missedCount === 0;

  const allBundles = getLessonList()
    .map((l) => l.bundle)
    .filter((b): b is NonNullable<typeof b> => b !== null);
  const recommendation = pickRecommendedLesson(missed, allBundles);
  const curriculum = buildPersonalCurriculum(missed, new Set<string>(), allBundles);
  const primaryLessonId = curriculum.nextLessonId ?? recommendation?.lessonId ?? null;

  const openCurriculumLesson = (lessonId: string) => {
    logEvent('curriculum_viewed', { from: 'result' });
    onFinish(primaryLessonId);
    router.push(`/lesson?lesson=${lessonId}`);
  };

  return (
    <Screen>
      <ThemedText variant="title">診断結果</ThemedText>
      <ThemedText variant="caption" color="muted" style={styles.subtitle}>
        {allCorrect
          ? '音の変化をしっかり聞き取れています。次のステップへ進みましょう。'
          : '単語は知っているのに聞き取れない原因が、音の変化に見つかっています。'}
      </ThemedText>

      {/* ブロック 1: スコア & 音変化別ビジュアル内訳カード (P4 可視化 > 文章) */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.scoreHeaderRow}>
          <View>
            <ThemedText variant="caption" color="muted">
              聞き取りスコア
            </ThemedText>
            <ThemedText variant="title" color="primary">
              {correctCount} <ThemedText variant="caption" color="muted">/ {results.length} 問正解</ThemedText>
            </ThemedText>
          </View>
          <View style={[styles.statusPill, { backgroundColor: colors.secondarySurface }]}>
            <ThemedText
              variant="caption"
              style={{
                color: allCorrect ? colors.success : colors.warning,
                fontWeight: '700',
              }}
            >
              {allCorrect ? '✓ 全問クリア' : `△ 要強化 ${missedCount} 件`}
            </ThemedText>
          </View>
        </View>

        <View style={[styles.scoreTrack, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.scoreFill,
              {
                width: `${scoreRatio * 100}%`,
                backgroundColor: allCorrect ? colors.success : colors.primary,
              },
            ]}
          />
        </View>

        <View style={styles.breakdownList}>
          {results.map((r, idx) => {
            const typeColor = getLinkingColor(r.type, scheme);
            return (
              <View
                key={`${r.type}-${idx}`}
                style={[styles.breakdownRow, { borderTopColor: colors.border }]}
              >
                <View style={styles.breakdownLeft}>
                  <ThemedText
                    variant="caption"
                    style={[
                      styles.breakdownType,
                      { color: typeColor, textDecorationColor: typeColor },
                      LINKING_TEXT_DECORATIONS[r.type],
                    ]}
                  >
                    {LINKING_LABELS[r.type] ?? r.type}
                  </ThemedText>
                  <ThemedText variant="caption" color="muted">
                    “{r.span}”
                  </ThemedText>
                </View>
                <ThemedText
                  variant="caption"
                  style={{
                    color: r.correct ? colors.success : colors.warning,
                    fontWeight: '700',
                  }}
                >
                  {r.correct ? '✓ 聞き取れた' : '△ 要強化'}
                </ThemedText>
              </View>
            );
          })}
        </View>

        {missedCount > 0 ? (
          <ThemedText variant="caption" color="muted" style={styles.autoAddedNote}>
            要強化の {missedCount} 文を「苦手フレーズ」に自動登録しました。
          </ThemedText>
        ) : null}
      </View>

      {/* ブロック 2: あなた向けカリキュラム (タイプ別の学習順序と対象レッスン + 唯一の青 CTA) */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <ThemedText variant="heading">あなた向けカリキュラム</ThemedText>
        <ThemedText variant="caption" color="muted">
          {allCorrect
            ? '基礎から自然な速度まで 3 ステップで聞き取りを伸ばす学習順です。'
            : 'つまずいた音変化から順に克服できるよう、対象レッスンを組みました。'}
        </ThemedText>
        <View style={styles.curriculumList}>
          {curriculum.steps.map((step) => {
            const typeColor = getLinkingColor(step.type, scheme);
            const firstLesson = step.lessons[0];
            return (
              <Pressable
                key={step.stepNumber}
                disabled={!firstLesson}
                onPress={() => {
                  if (firstLesson) openCurriculumLesson(firstLesson.lessonId);
                }}
                accessibilityRole="button"
                accessibilityLabel={`ステップ${step.stepNumber} ${step.label}: ${step.lessons.map((l) => l.titleJa).join('、')}`}
                style={[
                  styles.curriculumRow,
                  { backgroundColor: colors.secondarySurface, borderColor: colors.border },
                ]}
              >
                <View style={styles.curriculumTopRow}>
                  <ThemedText variant="caption" color="primary" style={styles.stepLabel}>
                    ステップ {step.stepNumber}
                  </ThemedText>
                  <ThemedText variant="caption" style={[styles.stepTypeText, { color: typeColor }]}>
                    {step.symbol} {step.label}
                  </ThemedText>
                  {step.isWeakTarget ? (
                    <ThemedText variant="caption" style={{ color: colors.warning, fontWeight: '700' }}>
                      重点
                    </ThemedText>
                  ) : null}
                </View>
                <ThemedText variant="caption" color="muted" numberOfLines={2}>
                  対象: {step.lessons.map((l) => `${l.titleJa}(${l.level === 'beginner' ? '初級' : '中級'})`).join(' → ')}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
        {primaryLessonId ? (
          <Pressable
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            accessibilityRole="button"
            onPress={() => openCurriculumLesson(primaryLessonId)}
          >
            <ThemedText style={{ color: colors.primaryText, fontWeight: '700' }}>
              ステップ 1 から始める
            </ThemedText>
          </Pressable>
        ) : null}
      </View>

      <Pressable
        onPress={() => onFinish(primaryLessonId)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        style={styles.skipButton}
      >
        <ThemedText variant="caption" color="muted">
          ライブラリへ進む
        </ThemedText>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  introHero: {
    gap: 8,
    marginTop: 8,
  },
  heroBadge: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  introPointsCard: {
    gap: 10,
    marginBottom: 8,
  },
  introPointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  introPointBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '700',
    overflow: 'hidden',
  },
  subtitle: { marginTop: 4, marginBottom: 12 },
  progressHeader: {
    gap: 6,
    marginBottom: 12,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
  },
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
    marginTop: 12,
  },
  questionTitle: { marginTop: 4 },
  sentenceCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginTop: 12,
  },
  maskedSentence: { fontSize: 17, lineHeight: 26 },
  choicesList: {
    gap: 8,
    marginTop: 12,
  },
  choiceButton: {
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  explainCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 8,
    marginTop: 12,
  },
  explainTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  typeBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  typeBadgeText: {
    fontWeight: '700',
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 8,
    marginTop: 12,
  },
  scoreHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  scoreTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 4,
  },
  scoreFill: {
    height: 8,
    borderRadius: 4,
  },
  breakdownList: {
    marginTop: 4,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  breakdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  breakdownType: {
    fontWeight: '700',
  },
  autoAddedNote: {
    marginTop: 2,
  },
  curriculumList: {
    gap: 8,
    marginTop: 4,
  },
  curriculumRow: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  curriculumTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepLabel: {
    fontWeight: '700',
  },
  stepTypeText: {
    fontWeight: '700',
  },
  gap: { marginTop: 4 },
});
