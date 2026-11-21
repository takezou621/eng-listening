import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';

import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { getLegalDoc, type LegalDocId } from '@/features/legal/legalContent';
import { useTheme } from '@/theme/AppThemeProvider';

/**
 * 法務ドキュメント表示画面 (プライバシーポリシー / 利用規約 / 特商法表記)。
 * 文面は src/features/legal/legalContent.ts を正とし、docs/legal/ 配下の
 * Markdown にも同じ内容をドラフトとして保存している (最終確定は GM／オーナー)。
 */

export default function LegalScreen() {
  const params = useLocalSearchParams<{ doc?: string | string[] }>();
  const docParam = Array.isArray(params.doc) ? params.doc[0] : params.doc;
  const { colors } = useTheme();
  const [lang, setLang] = useState<'ja' | 'en'>('ja');

  const docId: LegalDocId = docParam === 'terms' ? 'terms' : docParam === 'tokushoho' ? 'tokushoho' : 'privacy';
  const doc = getLegalDoc(docId);

  return (
    <Screen scroll={false}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: lang === 'ja' ? doc.titleJa : doc.titleEn,
          headerBackTitle: '戻る',
        }}
      />
      <ThemedText variant="title">{lang === 'ja' ? doc.titleJa : doc.titleEn}</ThemedText>
      <ThemedText variant="caption" color="muted" style={styles.draft}>
        {lang === 'ja' ? doc.draftNoticeJa : doc.draftNoticeEn}
      </ThemedText>

      <View style={styles.langRow}>
        <Pressable
          onPress={() => setLang('ja')}
          accessibilityRole="button"
          accessibilityState={{ selected: lang === 'ja' }}
          style={[styles.langChip, { backgroundColor: lang === 'ja' ? colors.primary : colors.secondarySurface }]}
        >
          <ThemedText variant="caption" style={lang === 'ja' ? { color: colors.primaryText, fontWeight: '700' } : undefined}>
            日本語
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={() => setLang('en')}
          accessibilityRole="button"
          accessibilityState={{ selected: lang === 'en' }}
          style={[styles.langChip, { backgroundColor: lang === 'en' ? colors.primary : colors.secondarySurface }]}
        >
          <ThemedText variant="caption" style={lang === 'en' ? { color: colors.primaryText, fontWeight: '700' } : undefined}>
            English
          </ThemedText>
        </Pressable>
      </View>

      <ScrollView style={styles.body}>
        {(lang === 'ja' ? doc.sectionsJa : doc.sectionsEn).map((section, i) => (
          <View key={i} style={styles.section}>
            <ThemedText variant="heading">{section.heading}</ThemedText>
            {section.paragraphs.map((p, j) => (
              <ThemedText key={j} variant="caption" color="muted" style={styles.paragraph}>
                {p}
              </ThemedText>
            ))}
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  draft: { marginTop: 4, marginBottom: 8 },
  langRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  langChip: { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 },
  body: { flex: 1 },
  section: { marginBottom: 16 },
  paragraph: { marginTop: 4, lineHeight: 20 },
});
