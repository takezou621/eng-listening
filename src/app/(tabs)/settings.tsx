
import { Pressable, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { APP_CONFIG } from '@/config/appConfig';
import { useRouter } from 'expo-router';
import { useTheme } from '@/theme/AppThemeProvider';

function Row({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      {/* 値が長い識別子でも折り返して行から溢れないようにする */}
      <ThemedText style={styles.rowLabel} numberOfLines={2}>
        {label}
      </ThemedText>
      <ThemedText color="muted" style={styles.rowValue} numberOfLines={2} selectable>
        {value}
      </ThemedText>
    </View>
  );
}

/** 設定 (骨格)。永続化は次フェーズで AsyncStorage 導入 */

export default function SettingsScreen() {
  const router = useRouter();
  const { scheme, colors } = useTheme();

  return (
    <Screen>
      <Pressable
        onPress={() => router.push('/onboarding')}
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: colors.secondarySurface,
          borderRadius: 12,
          padding: 14,
          marginBottom: 16,
        }}
      >
        <ThemedText>聞き取り診断をもう一度行う</ThemedText>
        <ThemedText color="muted">›</ThemedText>
      </Pressable>
      <ThemedText variant="title">設定</ThemedText>

      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {([
          { doc: 'privacy', label: 'プライバシーポリシー' },
          { doc: 'terms', label: '利用規約' },
          { doc: 'tokushoho', label: '特定商取引法に基づく表記' },
        ] as const).map((item) => (
          <Pressable
            key={item.doc}
            onPress={() => router.push(`/legal?doc=${item.doc}`)}
            style={[styles.legalRow, { borderBottomColor: colors.border }]}
          >
            <ThemedText>{item.label}</ThemedText>
            <ThemedText color="muted">›</ThemedText>
          </Pressable>
        ))}
      </View>

      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Row label="テーマ" value={scheme === 'dark' ? 'ダーク (システム追従)' : 'ライト (システム追従)'} />
        <Row label="バージョン" value={`v${APP_CONFIG.version}`} />
        <Row label="iOS Bundle ID (仮)" value={APP_CONFIG.iosBundleIdentifier} />
        <Row label="Android package (仮)" value={APP_CONFIG.androidPackageName} />
      </View>

      <ThemedText variant="heading" style={styles.sectionTitle}>
        開発
      </ThemedText>
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.row}>
          <ThemedText>オーディオスパイク</ThemedText>
          <ThemedText
            color="primary"
            style={styles.link}
            onPress={() => router.push('/spike')}
          >
            開く →
          </ThemedText>
        </View>
      </View>

      <ThemedText variant="caption" color="muted" style={styles.note}>
        設定項目の永続化・課金状態の表示は課金フェーズ (#17–) で実装予定
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  legalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: { flexShrink: 1 },
  rowValue: { flexShrink: 1, textAlign: 'right' },
  section: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  sectionTitle: { marginTop: 20 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  link: { fontWeight: '600' },
  note: { marginTop: 16 },
});
