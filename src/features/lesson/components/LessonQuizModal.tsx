import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { LINKING_LABELS } from '@/features/lesson/linkingViz';
import { lessonQuizOptions, type LessonQuizQuestion } from '@/features/learning/lessonQuiz';
import { useTheme } from '@/theme/AppThemeProvider';

/**
 * レッスン完了直後に差し込むミニ聞き分けクイズ (Issue #103)。
 * 1 問ずつ表示し、解答後にのみ解説 (正解フレーズ・音の変化・日本語訳) を出す。
 * P1: プライマリ (青フィル) は「次へ / 結果を見る」の 1 つのみ。解答前はテキスト操作のみ。
 * 計測 (lesson_quiz_*) と文区間の再生は親に委ねる。
 * 解答状態は親が `key` を変えてマウントし直すことで初期化する (effect 内 setState を避ける)。
 */
export function LessonQuizModal({
  visible,
  questions,
  replaying,
  onReplay,
  onAnswered,
  onFinished,
  onSkip,
}: {
  visible: boolean;
  questions: readonly LessonQuizQuestion[];
  /** 親が管理する「文区間を再生中」状態。再生中はボタンを無効化 (連打対策) */
  replaying: boolean;
  /** 文区間の再生を親に委ねる */
  onReplay: (question: LessonQuizQuestion) => void;
  onAnswered: (question: LessonQuizQuestion, selectedText: string, correct: boolean) => void;
  /** 全問完了時 */
  onFinished: (answeredCount: number) => void;
  /** 未解答のまま閉じた場合 */
  onSkip: (answeredCount: number) => void;
}) {
  const { colors } = useTheme();
  const total = questions.length;
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);

  const question = index < total ? questions[index] : null;
  const answered = selected !== null;

  // 選択肢順は問ごとに 1 回だけシャッフルして固定 (解答中に並びが変わらないようにする)
  const options = useMemo(
    () => (question ? lessonQuizOptions(question) : []),
    [question],
  );

  if (!question) return null;

  const handleSelect = (text: string) => {
    if (answered) return;
    setSelected(text);
    onAnswered(question, text, text === question.correctText);
  };

  const handleReplay = () => {
    if (answered || replaying) return;
    onReplay(question);
  };

  const handleNext = () => {
    if (!answered) return;
    if (index + 1 < total) {
      setIndex(index + 1);
      setSelected(null);
    } else {
      onFinished(total);
    }
  };

  const handleSkip = () => {
    if (answered) return;
    onSkip(index);
  };

  const handleRequestClose = () => {
    if (answered) handleNext();
    else handleSkip();
  };

  const isLast = index + 1 >= total;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleRequestClose}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ThemedText variant="caption" color="muted" style={styles.caption}>
            聞き分けチェック ({index + 1}/{total})
          </ThemedText>

          <ThemedText variant="heading" style={styles.prompt}>
            {question.prompt}
          </ThemedText>

          <View style={styles.options}>
            {options.map((text) => {
              const isSelected = selected === text;
              const isCorrect = text === question.correctText;
              const showCorrect = answered && isCorrect;
              const showWrong = answered && isSelected && !isCorrect;
              return (
                <Pressable
                  key={text}
                  onPress={() => handleSelect(text)}
                  disabled={answered}
                  accessibilityRole="button"
                  accessibilityLabel={text}
                  accessibilityState={{ selected: isSelected, disabled: answered }}
                  style={[
                    styles.option,
                    {
                      backgroundColor: showCorrect
                        ? colors.success
                        : showWrong
                          ? colors.danger
                          : colors.secondarySurface,
                      borderColor: showCorrect
                        ? colors.success
                        : showWrong
                          ? colors.danger
                          : colors.border,
                    },
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.optionText,
                      (showCorrect || showWrong) && { color: colors.primaryText, fontWeight: '700' },
                    ]}
                  >
                    {text}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          {answered ? (
            <View style={[styles.explain, { backgroundColor: colors.secondarySurface }]}>
              <View style={styles.explainRow}>
                <ThemedText variant="caption" color="primary" style={styles.explainLabel}>
                  音の変化: {LINKING_LABELS[question.soundChangeType]}
                </ThemedText>
                <ThemedText variant="caption" color="muted" style={styles.explainIpa} numberOfLines={1}>
                  {question.ipa}
                </ThemedText>
              </View>
              <ThemedText variant="body" style={styles.explainSpan} numberOfLines={2}>
                “{question.correctText}”
              </ThemedText>
              <ThemedText variant="caption" color="muted" numberOfLines={2}>
                {question.noteJa}
              </ThemedText>
            </View>
          ) : null}

          {answered ? (
            <Pressable
              onPress={handleNext}
              style={[styles.primaryButton, { backgroundColor: colors.primary }]}
              accessibilityRole="button"
            >
              <ThemedText style={{ color: colors.primaryText, fontWeight: '700' }}>
                {isLast ? '結果を見る' : '次へ'}
              </ThemedText>
            </Pressable>
          ) : (
            <View style={styles.textActions}>
              <Pressable
                onPress={handleReplay}
                disabled={replaying}
                hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="もう一度聞く"
                accessibilityState={{ disabled: replaying }}
                style={styles.textAction}
              >
                <ThemedText
                  variant="caption"
                  color="primary"
                  style={[styles.textActionLabel, replaying && styles.textActionDisabled]}
                >
                  {replaying ? '再生中…' : '▶ もう一度聞く'}
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={handleSkip}
                hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="スキップして完了画面へ"
                style={styles.textAction}
              >
                <ThemedText variant="caption" color="muted" style={styles.textActionLabel}>
                  スキップ ›
                </ThemedText>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // 背面のレッスン本文 (空欄の正解がそのまま見える) を読めなくする厚さにする (W8)
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    gap: 12,
  },
  caption: {
    textAlign: 'center',
  },
  prompt: {
    lineHeight: 26,
  },
  options: {
    gap: 8,
  },
  option: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 44,
    justifyContent: 'center',
  },
  optionText: {
    fontSize: 15,
  },
  explain: {
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  explainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  explainLabel: {
    fontWeight: '700',
  },
  explainIpa: {
    flex: 1,
  },
  explainSpan: {
    fontWeight: '700',
  },
  primaryButton: {
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  textActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
  },
  textAction: {
    paddingVertical: 8,
  },
  textActionLabel: {
    fontWeight: '600',
  },
  textActionDisabled: {
    opacity: 0.5,
  },
});
