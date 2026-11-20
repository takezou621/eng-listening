export type AppColorScheme = 'light' | 'dark';

export interface ThemeColors {
  background: string;
  surface: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  primaryText: string;
  secondarySurface: string;
  badgeTypeBg: string;
  badgeTypeText: string;
  tabIconActive: string;
  tabIconInactive: string;
  /** 学習ヒートマップの濃淡 (0 分 / 15 分未満 / 30 分未満 / 30 分以上) */
  heatLevels: [string, string, string, string];
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
  badgeTypeBg: '#DBEAFE',
  badgeTypeText: '#1D4ED8',
  tabIconActive: '#2563EB',
  tabIconInactive: '#9CA3AF',
  // ライト: 白背景の上で濃いほど学習量が多いことが見えるように青を濃くする
  heatLevels: ['#E2E5EA', '#93C5FD', '#3B82F6', '#1D4ED8'],
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
  badgeTypeBg: '#1E3A8A',
  badgeTypeText: '#93C5FD',
  tabIconActive: '#60A5FA',
  tabIconInactive: '#64748B',
  // ダーク: 暗い背景の上で明るい色ほど学習量が多いことが見えるようにする
  heatLevels: ['#263248', '#1E40AF', '#3B82F6', '#93C5FD'],
};

export function getThemeColors(scheme: AppColorScheme): ThemeColors {
  return scheme === 'dark' ? darkColors : lightColors;
}
