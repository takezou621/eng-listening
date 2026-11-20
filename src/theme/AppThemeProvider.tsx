import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import {
  getThemeColors,
  lightColors,
  type AppColorScheme,
  type ThemeColors,
} from './colors';

interface ThemeContextValue {
  scheme: AppColorScheme;
  colors: ThemeColors;
}

const ThemeContext = createContext<ThemeContextValue>({
  scheme: 'light',
  colors: lightColors,
});

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const value = useMemo<ThemeContextValue>(
    () => ({
      scheme: systemScheme === 'dark' ? 'dark' : 'light',
      colors: getThemeColors(systemScheme === 'dark' ? 'dark' : 'light'),
    }),
    [systemScheme]
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
