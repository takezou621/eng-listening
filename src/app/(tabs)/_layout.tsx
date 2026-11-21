import { Tabs } from 'expo-router';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Text, type ColorValue } from 'react-native';

import { useTheme } from '@/theme/AppThemeProvider';

/**
 * タブ構成:
 * ホーム = ライブラリ / 苦手フレーズ / 進捗 / 設定
 * (旧「プレイヤー」タブは未完成の骨格画面だったため廃止。再生はレッスン画面に一本化)
 */
export default function TabsLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.tabIconActive,
        tabBarInactiveTintColor: colors.tabIconInactive,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'ホーム',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="books.vertical.fill" fallback="📚" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="phrases"
        options={{
          title: '苦手フレーズ',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="flag.fill" fallback="⭐️" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: '進捗',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="chart.bar.fill" fallback="📈" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '設定',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="gearshape.fill" fallback="⚙️" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}

/**
 * タブアイコンは SF Symbols (E8)。色はタブのアクティブ/非アクティブ色に追随する。
 * 記号を表示できない環境では従来の絵文字にフォールバックする。
 * 苦手フレーズは、お気に入りの ★ と混同しないよう flag を使う。
 */
function TabIcon({
  name,
  fallback,
  color,
  size,
}: {
  name: SFSymbol;
  fallback: string;
  color: ColorValue;
  size: number;
}) {
  return (
    <SymbolView
      name={name}
      size={size}
      tintColor={typeof color === 'string' ? color : undefined}
      type="monochrome"
      resizeMode="scaleAspectFit"
      fallback={
        <Text style={{ fontSize: Math.round(size * 0.8), lineHeight: Math.round(size * 1.1) }}>
          {fallback}
        </Text>
      }
    />
  );
}
