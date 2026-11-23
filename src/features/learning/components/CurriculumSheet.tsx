import { Pressable, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { BottomSheet } from '@/components/BottomSheet';
import { ThemedText } from '@/components/ThemedText';
import type { PersonalCurriculum } from '@/features/learning/curriculum';
import { getLinkingColor } from '@/features/lesson/linkingViz';
import { useTheme } from '@/theme/AppThemeProvider';

/**
 * 診断結果にもとづく「あなた向けカリキュラム」(3ステップ学習順序 + 対象レッスン一覧) ボトムシート。
 */
export function CurriculumSheet({
  visible,
  curriculum,
  onSelectLesson,
  onClose,
}: {
  visible: boolean;
  curriculum: PersonalCurriculum;
  onSelectLesson: (lessonId: string) => void;
  onClose: () => void;
}) {
  const { scheme, colors } = useTheme();

  return (
    <BottomSheet visible={visible} title="あなた向けカリキュラム" onClose={onClose}>
      <ThemedText variant="caption" color="muted">
        {curriculum.isCustomizedByDiagnostic
          ? '診断結果で見つかった弱点タイプから順に、初級から中級へ段階的に克服する順序です。'
          : '会話でよく現れる音変化を基礎から順に定着させるおすすめコースです。'}
      </ThemedText>

      <View style={styles.stepsList}>
        {curriculum.steps.map((step) => {
          const typeColor = getLinkingColor(step.type, scheme);
          return (
            <View
              key={step.stepNumber}
              style={[
                styles.stepCard,
                { backgroundColor: colors.secondarySurface, borderColor: colors.border },
              ]}
            >
              <View style={styles.stepHeader}>
                <View style={styles.stepTitleGroup}>
                  <ThemedText variant="caption" color="primary" style={styles.stepNum}>
                    ステップ {step.stepNumber}
                  </ThemedText>
                  <View style={[styles.typeBadge, { backgroundColor: colors.surface, borderColor: typeColor }]}>
                    <ThemedText variant="caption" style={[styles.typeText, { color: typeColor }]}>
                      {step.symbol} {step.label}
                    </ThemedText>
                  </View>
                </View>
                {step.isWeakTarget ? (
                  <View style={[styles.weakPill, { backgroundColor: colors.surface }]}>
                    <ThemedText variant="caption" style={{ color: colors.warning, fontWeight: '700' }}>
                      重点強化
                    </ThemedText>
                  </View>
                ) : null}
              </View>

              <ThemedText variant="caption" color="muted">
                {step.focusReason}
              </ThemedText>

              <View style={styles.lessonsList}>
                {step.lessons.map((lesson) => (
                  <Pressable
                    key={lesson.lessonId}
                    onPress={() => {
                      onClose();
                      onSelectLesson(lesson.lessonId);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`${lesson.titleJa}（${lesson.level === 'beginner' ? '初級' : '中級'}${lesson.completed ? '・完了' : ''}）を開く`}
                    style={[
                      styles.lessonRow,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                    ]}
                  >
                    <View style={styles.lessonMeta}>
                      <ThemedText style={styles.lessonTitle} numberOfLines={1}>
                        {lesson.titleJa}
                      </ThemedText>
                      <ThemedText variant="caption" color="muted">
                        {lesson.level === 'beginner' ? '初級' : '中級'} ・ {step.label} {lesson.noteCount} 箇所
                      </ThemedText>
                    </View>
                    <View style={styles.lessonRight}>
                      {lesson.completed ? (
                        <SymbolView
                          name="checkmark.circle.fill"
                          size={16}
                          tintColor={colors.success}
                          fallback={
                            <ThemedText variant="caption" style={{ color: colors.success, fontWeight: '700' }}>
                              ✓
                            </ThemedText>
                          }
                        />
                      ) : (
                        <ThemedText variant="caption" color="primary" style={styles.startText}>
                          開く ›
                        </ThemedText>
                      )}
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          );
        })}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  stepsList: {
    gap: 12,
  },
  stepCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  stepTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  stepNum: {
    fontWeight: '700',
  },
  typeBadge: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  typeText: {
    fontWeight: '700',
  },
  weakPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  lessonsList: {
    gap: 6,
    marginTop: 2,
  },
  lessonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  lessonMeta: {
    flex: 1,
    gap: 2,
  },
  lessonTitle: {
    fontWeight: '600',
  },
  lessonRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  startText: {
    fontWeight: '700',
  },
});
