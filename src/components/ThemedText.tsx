import { StyleSheet, Text, type TextProps } from 'react-native';

import { useTheme } from '@/theme/AppThemeProvider';

interface ThemedTextProps extends TextProps {
  variant?: 'title' | 'heading' | 'body' | 'caption';
  color?: 'default' | 'muted' | 'primary';
}

export function ThemedText({ style, variant = 'body', color = 'default', ...rest }: ThemedTextProps) {
  const { colors } = useTheme();

  const colorStyle = {
    default: { color: colors.text },
    muted: { color: colors.textMuted },
    primary: { color: colors.primary },
  }[color];

  return (
    <Text style={[textStyles[variant], colorStyle, style]} {...rest} />
  );
}

const textStyles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '700' },
  heading: { fontSize: 17, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 22 },
  caption: { fontSize: 12, lineHeight: 17 },
});
