import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from './ThemedText';
import { useTheme } from '@/theme/AppThemeProvider';

interface ChipProps {
  label: string;
  active?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  /** filled: 既定の塗り潰し / outlined: 一覧フィルタ向けの控えめな枠線強調 */
  variant?: 'filled' | 'outlined';
}

/** 速度選択・フィルタなどで使う小さな選択チップ */
export function Chip({
  label,
  active = false,
  onPress,
  disabled,
  variant = 'filled',
}: ChipProps) {
  const { colors } = useTheme();
  const isOutlined = variant === 'outlined';
  const containerStyle = active
    ? isOutlined
      ? { backgroundColor: colors.secondarySurface, borderColor: colors.primary, borderWidth: 1.5 }
      : { backgroundColor: colors.primary, borderColor: colors.primary }
    : isOutlined
      ? { backgroundColor: colors.surface, borderColor: colors.border }
      : { backgroundColor: colors.secondarySurface, borderColor: colors.border };
  const labelStyle = active
    ? isOutlined
      ? { color: colors.primary, fontWeight: '700' as const }
      : { color: colors.primaryText }
    : undefined;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled: disabled ?? false }}
      style={[
        styles.chip,
        containerStyle,
        isOutlined && active && styles.outlinedActivePadding,
        disabled && styles.disabled,
      ]}
    >
      <ThemedText style={[styles.label, labelStyle]}>{label}</ThemedText>
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
  outlinedActivePadding: {
    paddingHorizontal: 13.5,
    paddingVertical: 7.5,
  },
  label: { fontSize: 13, fontWeight: '600' },
  disabled: { opacity: 0.4 },
});
