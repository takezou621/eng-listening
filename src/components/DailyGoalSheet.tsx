import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/ThemedText';
import {
  DAILY_GOAL_OPTIONS,
  type DailyGoalMinutes,
} from '@/features/library/userStore';
import { useTheme } from '@/theme/AppThemeProvider';

/**
 * 1日の学習目標を設定するボトムシート (Issue #46)。
 * ELSA のコーチ式目標設定と abceed の学習時間設定を参考に、
 * 3〜15 分から無理なく選べる段階開示 UI にしている。
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
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="シートを閉じる"
        />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <ThemedText variant="heading" style={styles.title}>
              1日の学習目標
            </ThemedText>
            <Pressable
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="閉じる"
            >
              <ThemedText color="primary" style={styles.closeText}>
                閉じる
              </ThemedText>
            </Pressable>
          </View>

          <View style={styles.body}>
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
                      <ThemedText
                        variant="heading"
                        color={selected ? 'primary' : 'default'}
                      >
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
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    paddingTop: 8,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    flex: 1,
  },
  closeText: {
    fontWeight: '600',
  },
  body: {
    padding: 16,
    gap: 12,
  },
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
