import { StyleSheet, Text, type StyleProp, type TextProps, type TextStyle } from 'react-native';

import { useTheme } from '@/theme/AppThemeProvider';

interface ThemedTextProps extends TextProps {
  variant?: 'title' | 'heading' | 'body' | 'caption';
  color?: 'default' | 'muted' | 'primary';
}

/**
 * style 内の undefined 値を取り除く。
 * { color: undefined } のような指定がテーマ色を上書きして既定色 (黒) に戻り、
 * ダークモードで文字が読めなくなる事故を防ぐための根治策 (2026-11-21 の障害対応)。
 */
function stripUndefinedStyles(style: StyleProp<TextStyle>): StyleProp<TextStyle> {
  if (Array.isArray(style)) {
    return style.map((entry) => stripUndefinedStyles(entry as StyleProp<TextStyle>));
  }
  if (style && typeof style === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(style as Record<string, unknown>)) {
      if (value !== undefined) {
        out[key] = value;
      }
    }
    return out as TextStyle;
  }
  return style;
}

export function ThemedText({ style, variant = 'body', color = 'default', ...rest }: ThemedTextProps) {
  const { colors } = useTheme();

  const colorStyle = {
    default: { color: colors.text },
    muted: { color: colors.textMuted },
    primary: { color: colors.primary },
  }[color];

  return (
    <Text style={[textStyles[variant], colorStyle, stripUndefinedStyles(style)]} {...rest} />
  );
}

const textStyles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '700' },
  heading: { fontSize: 17, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 22 },
  caption: { fontSize: 12, lineHeight: 17 },
});
