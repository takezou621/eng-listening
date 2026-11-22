import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/theme/AppThemeProvider';

/**
 * スパイク画面 (src/app/spike.tsx) とレッスン画面 (src/app/lesson.tsx) で
 * 共有する再生まわりの表示ヘルパー。両画面のコピーが漂うのを防ぐ。
 */

export function formatTime(seconds: number): string {
  const s = Math.max(0, seconds);
  return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
}

export function ControlButton({
  label,
  onPress,
  primary = false,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      accessibilityRole="button"
      style={[
        styles.controlButton,
        primary ? { backgroundColor: colors.primary } : { backgroundColor: colors.secondarySurface },
      ]}
    >
      <ThemedText style={{ color: primary ? colors.primaryText : colors.text, fontWeight: '600' }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  controlButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
});
