import { type ReactNode } from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/AppThemeProvider';

interface ScreenProps {
  children: ReactNode;
  /** True のとき縦スクロール可能にする (デフォルト) */
  scroll?: boolean;
  padded?: boolean;
}

export function Screen({ children, scroll = true, padded = true }: ScreenProps) {
  const { colors } = useTheme();
  const style = [
    styles.base,
    { backgroundColor: colors.background },
    padded ? styles.padded : null,
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {scroll ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={style}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, style]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  base: {},
  padded: { paddingHorizontal: 16, paddingTop: 12 },
});
