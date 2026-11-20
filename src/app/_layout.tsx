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
import { SelectionProvider } from '@/state/SelectionContext';

export default function RootLayout() {
  const scheme = useColorScheme();
  const router = useRouter();

  // 開発用: EXPO_PUBLIC_SPIKE_AUTO_DEMO=1 で Metro を起動すると、
  // 起動直後にオーディオスパイク画面の自動デモを開く (シミュレータ自動検証用)。
  // 本番ビルドでは一切動作しない (__DEV__ ガード)。docs/dev-setup.md 参照。
  useEffect(() => {
    if (__DEV__ && process.env.EXPO_PUBLIC_SPIKE_AUTO_DEMO === '1') {
      router.replace({ pathname: '/spike', params: { demo: '1' } });
    }
  }, [router]);

  // expo-router のナビゲーションテーマ (ステータスバー等) をシステム設定に追従させる
  const navTheme = useMemo(
    () =>
      scheme === 'dark'
        ? { ...DarkTheme, colors: { ...DarkTheme.colors, background: '#0B1220', card: '#151E2E' } }
        : { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: '#F6F7F9', card: '#FFFFFF' } },
    [scheme]
  );

  return (
    <AppThemeProvider>
      <ThemeProvider value={navTheme}>
        <SelectionProvider>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="spike"
              options={{ headerShown: true, title: 'オーディオスパイク', headerBackTitle: '戻る' }}
            />
          </Stack>
        </SelectionProvider>
      </ThemeProvider>
    </AppThemeProvider>
  );
}
