import { Tabs } from 'expo-router';
import { Text } from 'react-native';

import { useTheme } from '@/theme/AppThemeProvider';

/**
 * タブ構成 (GM 指示):
 * ホーム = ライブラリ / 学習プレイヤー / 苦手フレーズ / 設定
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
          tabBarIcon: ({ size }) => <TabIcon symbol="📚" size={size} />,
        }}
      />
      <Tabs.Screen
        name="player"
        options={{
          title: 'プレイヤー',
          tabBarIcon: ({ size }) => <TabIcon symbol="🎧" size={size} />,
        }}
      />
      <Tabs.Screen
        name="phrases"
        options={{
          title: '苦手フレーズ',
          tabBarIcon: ({ size }) => <TabIcon symbol="⭐️" size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '設定',
          tabBarIcon: ({ size }) => <TabIcon symbol="⚙️" size={size} />,
        }}
      />
    </Tabs>
  );
}

/** v0.1 は絵文字アイコンで土台のみ。ネイティブ SF Symbols / Material Icons は次フェーズで差し替え */
function TabIcon({ symbol, size }: { symbol: string; size: number }) {
  return (
    <Text style={{ fontSize: Math.round(size * 0.8), lineHeight: Math.round(size * 1.1) }}>
      {symbol}
    </Text>
  );
}
