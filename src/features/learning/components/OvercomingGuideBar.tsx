import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import {
  OVERCOMING_STEPS,
  type OvercomingStepKey,
} from '@/features/learning/overcomingPath';
import {
  LINKING_LABELS,
  LINKING_SYMBOLS,
  getLinkingColor,
} from '@/features/lesson/linkingViz';
import type { LessonLinkingNote } from '@/features/lesson/types';
import type { LessonMode } from '@/features/player/playerPrefs';
import { useTheme } from '@/theme/AppThemeProvider';

export interface OvercomingGuideBarProps {
  focusType: LessonLinkingNote['type'];
  completedSteps: Record<OvercomingStepKey, boolean>;
  currentMode: LessonMode;
  targetSentenceCount: number;
  currentSentenceHasTarget: boolean;
  onSelectStep: (step: OvercomingStepKey) => void;
  onJumpToTargetSentence: () => void;
}

/**
 * 弱点タイプ別の 3 ステップ克服バー (Phase 1-C)。
 * ① 聞き分け → ② 文で確認 → ③ 話す の進行度を示し、各ステップへ 1 タップ切替できる。
 */
export function OvercomingGuideBar({
  focusType,
  completedSteps,
  currentMode,
  targetSentenceCount,
  currentSentenceHasTarget,
  onSelectStep,
  onJumpToTargetSentence,
}: OvercomingGuideBarProps) {
  const { scheme, colors } = useTheme();
  const typeColor = getLinkingColor(focusType, scheme);
  const doneCount = OVERCOMING_STEPS.filter((s) => completedSteps[s.key]).length;
  const allDone = doneCount === OVERCOMING_STEPS.length;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderColor: allDone ? colors.success : typeColor,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.titleWrap}>
          <View
            style={[
              styles.symbolPill,
              { borderColor: typeColor, backgroundColor: colors.secondarySurface },
            ]}
          >
            <ThemedText variant="caption" style={[styles.symbolText, { color: typeColor }]}>
              {LINKING_SYMBOLS[focusType]}
            </ThemedText>
          </View>
          <ThemedText variant="caption" style={styles.titleText} numberOfLines={1}>
            「{LINKING_LABELS[focusType]}」克服パス
          </ThemedText>
        </View>

        <View
          style={[
            styles.progressBadge,
            {
              backgroundColor: allDone
                ? colors.secondarySurface
                : colors.secondarySurface,
              borderColor: allDone ? colors.success : colors.border,
            },
          ]}
        >
          <ThemedText
            variant="caption"
            style={[
              styles.progressText,
              { color: allDone ? colors.success : colors.primary },
            ]}
          >
            {allDone ? '3 / 3 完了 ✓' : `${doneCount} / 3 完了`}
          </ThemedText>
        </View>
      </View>

      <View style={styles.stepsRow}>
        {OVERCOMING_STEPS.map((step) => {
          const active = currentMode === step.key;
          const done = completedSteps[step.key];
          return (
            <Pressable
              key={step.key}
              onPress={() => onSelectStep(step.key)}
              hitSlop={{ top: 4, bottom: 4 }}
              accessibilityRole="button"
              accessibilityLabel={`${step.shortLabel}${done ? ' 完了' : ''}`}
              accessibilityState={{ selected: active, checked: done }}
              style={[
                styles.stepPill,
                {
                  backgroundColor: active ? colors.secondarySurface : colors.background,
                  borderColor: active
                    ? colors.primary
                    : done
                      ? colors.success
                      : colors.border,
                },
              ]}
            >
              <ThemedText
                variant="caption"
                style={[
                  styles.stepLabel,
                  {
                    color: done
                      ? colors.success
                      : active
                        ? colors.primary
                        : colors.textMuted,
                  },
                ]}
                numberOfLines={1}
              >
                {done ? `✓ ${step.shortLabel}` : step.shortLabel}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      {targetSentenceCount > 0 && !currentSentenceHasTarget ? (
        <View style={styles.jumpRow}>
          <ThemedText variant="caption" color="muted" style={styles.jumpHint} numberOfLines={1}>
            この文には注目音が含まれません
          </ThemedText>
          <Pressable
            onPress={onJumpToTargetSentence}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            accessibilityRole="button"
            accessibilityLabel="注目タイプを含む文へ移動"
          >
            <ThemedText variant="caption" color="primary" style={styles.jumpLink}>
              対象の文へ ›
            </ThemedText>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  titleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  symbolPill: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbolText: {
    fontWeight: '700',
    lineHeight: 16,
  },
  titleText: {
    flex: 1,
    fontWeight: '700',
  },
  progressBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  progressText: {
    fontWeight: '700',
  },
  stepsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  stepPill: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLabel: {
    fontWeight: '700',
    fontSize: 12,
  },
  jumpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingTop: 2,
  },
  jumpHint: {
    flex: 1,
  },
  jumpLink: {
    fontWeight: '700',
  },
});
