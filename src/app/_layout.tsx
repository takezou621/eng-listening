import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
} from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { WatchLibrarySync } from '@/features/watch/WatchLibrarySync';
import { AppThemeProvider } from '@/theme/AppThemeProvider';
import { darkColors, lightColors } from '@/theme/colors';

export default function RootLayout() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  // expo-router のナビゲーションテーマ (ステータスバー等) をシステム設定に追従させる
  const navTheme = useMemo(
    () =>
      isDark
        ? {
            ...DarkTheme,
            colors: {
              ...DarkTheme.colors,
              background: darkColors.background,
              card: darkColors.surface,
            },
          }
        : {
            ...DefaultTheme,
            colors: {
              ...DefaultTheme.colors,
              background: lightColors.background,
              card: lightColors.surface,
            },
          },
    [isDark]
  );


  return (
    <AppThemeProvider>
      <WatchLibrarySync />
      <ThemeProvider value={navTheme}>
          <StatusBar style={isDark ? 'light' : 'dark'} />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="lesson"
              options={{
                headerShown: true,
                title: 'レッスン',
                headerBackTitle: '戻る',
                headerTransparent: false,
                headerStyle: {
                  backgroundColor: isDark ? darkColors.surface : lightColors.surface,
                },
                headerTintColor: isDark ? darkColors.text : lightColors.text,
              }}
            />
            <Stack.Screen
              name="paywall"
              options={{
                headerShown: true,
                title: 'プレミアム',
                headerBackTitle: '戻る',
                headerTransparent: false,
                headerStyle: {
                  backgroundColor: isDark ? darkColors.surface : lightColors.surface,
                },
                headerTintColor: isDark ? darkColors.text : lightColors.text,
              }}
            />
            <Stack.Screen
              name="legal"
              options={{
                headerShown: true,
                title: '法的情報',
                headerBackTitle: '戻る',
                headerTransparent: false,
                headerStyle: {
                  backgroundColor: isDark ? darkColors.surface : lightColors.surface,
                },
                headerTintColor: isDark ? darkColors.text : lightColors.text,
              }}
            />
          </Stack>
      </ThemeProvider>
    </AppThemeProvider>
  );
}
