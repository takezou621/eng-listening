import { Pressable, StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { ThemedText } from '@/components/ThemedText';
import {
  DAILY_GOAL_OPTIONS,
  type DailyGoalMinutes,
} from '@/features/library/userStore';
import { useTheme } from '@/theme/AppThemeProvider';

/**
 * 1日の学習目標を設定するボトムシート (Issue #46)。
 * 汎用 BottomSheet をラップし、3〜15 分から無理なく選べる段階開示 UI にしている。
 */
export function DailyGoalSheet({
  visible,
  currentMinutes,
  onSelectGoal,
  onClose,
}: {
  visible: boolean;
  currentMinutes: DailyGoalMinutes;
  onSelectGoal: (minutes: DailyGoalMinutes) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();

  return (
    <BottomSheet visible={visible} title="1日の学習目標" onClose={onClose}>
      <ThemedText variant="caption" color="muted">
        無理なく続けられる時間を選びましょう（いつでも変更できます）
      </ThemedText>

      <View style={styles.optionList}>
        {DAILY_GOAL_OPTIONS.map((opt) => {
          const selected = currentMinutes === opt.minutes;
          return (
            <Pressable
              key={opt.minutes}
              onPress={() => {
                onSelectGoal(opt.minutes);
                onClose();
              }}
              style={[
                styles.optionCard,
                {
                  backgroundColor: selected ? colors.secondarySurface : colors.surface,
                  borderColor: selected ? colors.primary : colors.border,
                  borderWidth: selected ? 2 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${opt.title} ${opt.hint}`}
            >
              <View style={styles.optionText}>
                <ThemedText variant="heading" color={selected ? 'primary' : 'default'}>
                  {opt.title}
                </ThemedText>
                <ThemedText variant="caption" color="muted">
                  {opt.hint}
                </ThemedText>
              </View>
              {selected ? (
                <ThemedText color="primary" style={styles.checkMark}>
                  ✓
                </ThemedText>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  optionList: {
    gap: 8,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  optionText: {
    flex: 1,
    gap: 2,
  },
  checkMark: {
    fontSize: 18,
    fontWeight: '700',
  },
});
