import { type ComponentRef, type ReactNode, type RefObject } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/AppThemeProvider';

interface ScreenProps {
  children: ReactNode;
  /** True のとき縦スクロール可能にする (デフォルト) */
  scroll?: boolean;
  padded?: boolean;
  /** スクロールをプログラムで制御したい場合に渡す (深い位置の要素へのジャンプなど) */
  scrollRef?: RefObject<ComponentRef<typeof ScrollView> | null>;
  /** ユーザーが手でスクロールを始めたときに呼ばれる (自動スクロールとの干渉回避用) */
  onScrollBeginDrag?: () => void;
}

export function Screen({ children, scroll = true, padded = true, scrollRef, onScrollBeginDrag }: ScreenProps) {
  const { colors } = useTheme();
  // 背景色はコンテナとスクロール領域の両方に敷く (バウンス時の露出防止)
  const paddedStyle = [styles.content, { backgroundColor: colors.background }, padded && styles.padded];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      {scroll ? (
        <ScrollView
          ref={scrollRef}
          onScrollBeginDrag={onScrollBeginDrag}
          style={styles.flex}
          contentContainerStyle={paddedStyle}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, paddedStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: { flexGrow: 1 },
  padded: { paddingHorizontal: 16, paddingTop: 12 },
});
