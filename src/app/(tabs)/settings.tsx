import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { APP_CONFIG } from '@/config/appConfig';
import { useRouter } from 'expo-router';
import {
  initBillingAsync,
  restorePurchasesAsync,
  useEntitlement,
  type RestoreResult,
} from '@/features/billing/billingStore';
import { useTheme } from '@/theme/AppThemeProvider';

function Row({ label, value, isLast = false }: { label: string; value: string; isLast?: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.row,
        { borderBottomColor: colors.border },
        isLast && styles.rowLast,
      ]}
    >
      <ThemedText style={styles.rowLabel} numberOfLines={2}>
        {label}
      </ThemedText>
      <ThemedText color="muted" style={styles.rowValue} numberOfLines={2}>
        {value}
      </ThemedText>
    </View>
  );
}

function LinkRow({ label, onPress, isLast = false }: { label: string; onPress: () => void; isLast?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.legalRow,
        { borderBottomColor: colors.border },
        isLast && styles.rowLast,
      ]}
    >
      <ThemedText>{label}</ThemedText>
      <ThemedText color="muted">›</ThemedText>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { scheme, colors } = useTheme();
  const { isPremium, isLoading, isAvailable } = useEntitlement();
  const [restoring, setRestoring] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState('');

  useEffect(() => {
    void initBillingAsync();
  }, []);

  const handleRestore = async () => {
    if (!isAvailable || restoring) return;
    setRestoreMessage('');
    setRestoring(true);
    const result: RestoreResult = await restorePurchasesAsync();
    setRestoring(false);
    if (result.restored && result.premium) {
      setRestoreMessage('プレミアムが復元されました。');
    } else if (result.restored) {
      setRestoreMessage('復元できるプレミアム購入が見つかりませんでした。');
    } else {
      setRestoreMessage('復元に失敗しました。時間をおいて再度お試しください。');
    }
  };

  return (
    <Screen>
      <ThemedText variant="title">設定</ThemedText>

      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Row
          label="現在のプラン"
          value={isLoading ? '確認中…' : isPremium ? 'プレミアム' : '無料プラン'}
        />
        <LinkRow label="プレミアムについて" onPress={() => router.push('/paywall')} />
        <Pressable
          onPress={handleRestore}
          disabled={!isAvailable || isLoading || restoring}
          style={[styles.legalRow, styles.rowLast]}
        >
          <ThemedText color="primary">購入を復元</ThemedText>
          <ThemedText color="muted">{restoring ? '復元中…' : ''}</ThemedText>
        </Pressable>
      </View>
      {restoreMessage ? (
        <ThemedText variant="caption" color="muted" style={styles.note}>
          {restoreMessage}
        </ThemedText>
      ) : null}

      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <LinkRow
          label="聞き取り診断をもう一度行う"
          onPress={() => router.push('/onboarding')}
          isLast
        />
      </View>

      <ThemedText variant="caption" color="muted" style={styles.groupLabel}>
        サポート
      </ThemedText>
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <LinkRow
          label="サポートページを開く"
          onPress={() => void Linking.openURL('https://33eigo.win/support')}
        />
        <Row label="お問い合わせ" value="support@33eigo.win" isLast />
      </View>

      <ThemedText variant="caption" color="muted" style={styles.groupLabel}>
        法的情報
      </ThemedText>
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {([
          { doc: 'privacy', label: 'プライバシーポリシー' },
          { doc: 'terms', label: '利用規約' },
          { doc: 'tokushoho', label: '特定商取引法に基づく表記' },
        ] as const).map((item, idx, arr) => (
          <LinkRow
            key={item.doc}
            label={item.label}
            onPress={() => router.push(`/legal?doc=${item.doc}`)}
            isLast={idx === arr.length - 1}
          />
        ))}
      </View>

      <ThemedText variant="caption" color="muted" style={styles.groupLabel}>
        アプリ情報
      </ThemedText>
      <View
        style={[
          styles.section,
          styles.lastSection,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Row label="テーマ" value={scheme === 'dark' ? 'ダーク (端末の設定に連動)' : 'ライト (端末の設定に連動)'} />
        <Row label="バージョン" value={`v${APP_CONFIG.version}`} isLast />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  legalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowLabel: { flexShrink: 1 },
  rowValue: { flexShrink: 1, textAlign: 'right' },
  section: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  lastSection: {
    marginBottom: 24,
  },
  groupLabel: {
    marginTop: 16,
    marginLeft: 4,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  note: { marginTop: 8 },
});
