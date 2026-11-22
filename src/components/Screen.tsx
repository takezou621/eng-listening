import { type ComponentRef, type ReactNode, type RefObject } from 'react';
import { ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
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
  /** スクロール位置の通知 (自動スクロールの座標計算用) */
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** スクロール領域の下に固定表示するフッター (再生バーなど)。指定時は下部セーフエリアも確保する */
  footer?: ReactNode;
}

export function Screen({ children, scroll = true, padded = true, scrollRef, onScrollBeginDrag, onScroll, footer }: ScreenProps) {
  const { colors } = useTheme();
  // 背景色はコンテナとスクロール領域の両方に敷く (バウンス時の露出防止)
  const paddedStyle = [styles.content, { backgroundColor: colors.background }, padded && styles.padded];

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      // 左右のセーフエリアも適用する: iPhone Duo の外側ディスプレイでは右端に
      // センサーバーがあり、右インセット 84pt が報告される (Issue #60 で実測)。
      // 通常の iPhone (縦向き) では左右 0 のため見た目は変わらない。
      edges={footer ? ['top', 'bottom', 'left', 'right'] : ['top', 'left', 'right']}
    >
      {scroll ? (
        <ScrollView
          ref={scrollRef}
          onScrollBeginDrag={onScrollBeginDrag}
          onScroll={onScroll}
          scrollEventThrottle={16}
          style={styles.flex}
          contentContainerStyle={paddedStyle}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, paddedStyle]}>{children}</View>
      )}
      {footer}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: { flexGrow: 1 },
  padded: { paddingHorizontal: 16, paddingTop: 12 },
});
