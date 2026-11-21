import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
  useRouter,
} from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { AppThemeProvider } from '@/theme/AppThemeProvider';
import { darkColors, lightColors } from '@/theme/colors';
import { SelectionProvider } from '@/state/SelectionContext';

export default function RootLayout() {
  const scheme = useColorScheme();
  const router = useRouter();
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

  // 開発用: EXPO_PUBLIC_SPIKE_AUTO_DEMO=1 で Metro を起動すると、
  // 起動直後にオーディオスパイク画面の自動デモを開く (シミュレータ自動検証用)。
  // 本番ビルドでは一切動作しない (__DEV__ ガード)。docs/dev-setup.md 参照。
  const autoDemo = process.env.EXPO_PUBLIC_SPIKE_AUTO_DEMO === '1';
  useEffect(() => {
    if (__DEV__ && autoDemo) {
      router.replace({ pathname: '/spike', params: { demo: '1' } });
    }
  }, [router, autoDemo]);


  return (
    <AppThemeProvider>
      <ThemeProvider value={navTheme}>
        <SelectionProvider>
          <StatusBar style={isDark ? 'light' : 'dark'} />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="spike"
              options={{ headerShown: true, title: 'オーディオスパイク', headerBackTitle: '戻る' }}
            />
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
        </SelectionProvider>
      </ThemeProvider>
    </AppThemeProvider>
  );
}
