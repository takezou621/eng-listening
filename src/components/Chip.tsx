import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from './ThemedText';
import { useTheme } from '@/theme/AppThemeProvider';

interface ChipProps {
  label: string;
  active?: boolean;
  onPress?: () => void;
  disabled?: boolean;
}

/** 速度選択・フィルタなどで使う小さな選択チップ */
export function Chip({ label, active = false, onPress, disabled }: ChipProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled: disabled ?? false }}
      style={[
        styles.chip,
        { borderColor: colors.border },
        active
          ? { backgroundColor: colors.primary, borderColor: colors.primary }
          : { backgroundColor: colors.surface },
        disabled && styles.disabled,
      ]}
    >
      <ThemedText style={[styles.label, active && { color: colors.primaryText }]}>{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
  },
  label: { fontSize: 13, fontWeight: '600' },
  disabled: { opacity: 0.4 },
});
