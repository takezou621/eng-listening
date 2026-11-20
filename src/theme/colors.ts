export type ColorSchemeName = 'light' | 'dark';

export interface ThemeColors {
  background: string;
  surface: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  primaryText: string;
  secondarySurface: string;
  accent: string;
  danger: string;
  tabIconActive: string;
  tabIconInactive: string;
}

export const lightColors: ThemeColors = {
  background: '#F6F7F9',
  surface: '#FFFFFF',
  border: '#E2E5EA',
  text: '#111827',
  textMuted: '#6B7280',
  primary: '#2563EB',
  primaryText: '#FFFFFF',
  secondarySurface: '#EEF2FF',
  accent: '#0EA5E9',
  danger: '#DC2626',
  tabIconActive: '#2563EB',
  tabIconInactive: '#9CA3AF',
};

export const darkColors: ThemeColors = {
  background: '#0B1220',
  surface: '#151E2E',
  border: '#263248',
  text: '#F3F4F6',
  textMuted: '#9CA3AF',
  primary: '#3B82F6',
  primaryText: '#0B1220',
  secondarySurface: '#1E293B',
  accent: '#38BDF8',
  danger: '#F87171',
  tabIconActive: '#60A5FA',
  tabIconInactive: '#64748B',
};

export function getThemeColors(scheme: ColorSchemeName): ThemeColors {
  return scheme === 'dark' ? darkColors : lightColors;
}
