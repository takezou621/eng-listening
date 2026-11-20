import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { WEAK_PHRASES } from '@/data';
import { useTheme } from '@/theme/AppThemeProvider';
import { StyleSheet, View } from 'react-native';

/** 苦手フレーズ帳 (モック)。本実装は #12: プレイリスト・復習スケジュール込み */
export default function PhrasesScreen() {
  const { colors } = useTheme();

  return (
    <Screen>
      <ThemedText variant="title">苦手フレーズ</ThemedText>
      <ThemedText variant="caption" color="muted" style={styles.subtitle}>
        {WEAK_PHRASES.length} 件 (モックデータ)
      </ThemedText>
      {WEAK_PHRASES.map((phrase) => (
        <View
          key={phrase.id}
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <ThemedText variant="heading">{phrase.text}</ThemedText>
          <ThemedText>{phrase.translationJa}</ThemedText>
          <ThemedText variant="caption" color="muted">
            {phrase.noteJa}
          </ThemedText>
        </View>
      ))}
      <ThemedText variant="caption" color="muted" style={styles.note}>
        プレイヤーからの保存フロー・復習機能は次フェーズ (#12) で実装
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: { marginTop: 4 },
  card: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  note: { marginTop: 16 },
});
