import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { DISPLAY_PRICES, PRODUCT_IDS } from '@/features/billing/config';
import { initBillingAsync, useEntitlement } from '@/features/billing/billingStore';
import { logEvent } from '@/features/analytics/analyticsStore';
import { useTheme } from '@/theme/AppThemeProvider';

/**
 * ペイウォール画面 (Issue #18)。
 *
 * - 表示時に分析イベント paywall_viewed を記録する (端末内ログ)
 * - 無料 / プレミアムの差分・価格・トライアル条件・解約方法を表示
 * - 利用規約・プライバシーポリシー (既存 /legal 画面) への導線
 * - ストア側の実商品が未設定の間は購入ボタンを無効化し、その理由を
 *   画面上に正直に表示する (ダミー購入成功は作らない)
 */

const PREMIUM_FEATURES_JA = [
  '全レッスンの完了後の詳細な弱点分析',
  '今後追加されるプレミアム限定レッスン・機能',
];

const FREE_FEATURES_JA = [
  '全 12 レッスンの再生・カラオケ表示・AB リピート',
  'シャドーイング録音と比較再生',
  'ライブラリ・お気に入り・苦手フレーズ帳',
  '学習進捗の記録と表示',
];

export default function PaywallScreen() {
  const params = useLocalSearchParams<{ from?: string | string[] }>();
  const fromParam = Array.isArray(params.from) ? params.from[0] : params.from;
  const router = useRouter();
  const { colors } = useTheme();
  const { isAvailable, isPremium, isLoading } = useEntitlement();

  useEffect(() => {
    void initBillingAsync();
    // ペイウォール表示を分析ログに記録 (端末内のみ)
    logEvent('paywall_viewed', { from: fromParam ?? 'settings' });
  }, [fromParam]);

  const productsConfigured = false; // ストア側の実商品が未作成のため常に false (設定後に PRODUCT_IDS 連動へ)

  const handlePurchase = () => {
    // 実購入はストア商品と RevenueCat の設定後に有効化する。
    // 現状はこのハンドラに到達しない (ボタン無効化)。
    // 実装時: purchases.purchaseProduct() → 成功コールバックで
    // logEvent('purchase_completed', { productId }) を発火する。
  };

  return (
    <Screen>
      <ThemedText variant="title">プレミアムに切り替える</ThemedText>
      <ThemedText variant="caption" color="muted" style={styles.subtitle}>
        単語は知っているのに聞き取れない — その理由を見つけたあとも、継続して鍛えられます。
      </ThemedText>

      {isPremium ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ThemedText variant="heading">プレミアムが有効です</ThemedText>
          <ThemedText variant="caption" color="muted">
            すべてのプレミアム機能をご利用いただけます。ご購入ありがとうございます。
          </ThemedText>
        </View>
      ) : null}

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <ThemedText variant="heading">無料で使える機能</ThemedText>
        {FREE_FEATURES_JA.map((f) => (
          <ThemedText key={f} variant="caption" color="muted" style={styles.featureRow}>
            ✓ {f}
          </ThemedText>
        ))}
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <ThemedText variant="heading">プレミアムで解放される機能</ThemedText>
        {PREMIUM_FEATURES_JA.map((f) => (
          <ThemedText key={f} variant="caption" style={styles.featureRow}>
            ★ {f}
          </ThemedText>
        ))}
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <ThemedText variant="heading">料金プラン</ThemedText>
        <ThemedText style={styles.priceRow}>{DISPLAY_PRICES.monthlyJa}</ThemedText>
        <ThemedText variant="caption" color="muted">
          自動更新。いつでも解約できます。
        </ThemedText>
        <ThemedText style={[styles.priceRow, { marginTop: 8 }]}>{DISPLAY_PRICES.annualJa}</ThemedText>
        <ThemedText variant="caption" color="muted">
          トライアル期間中に解約すれば請求されません。
        </ThemedText>
      </View>

      {/* 実商品が設定されていないため購入ボタンは無効 (理由を画面上に表示) */}
      <Pressable
        onPress={handlePurchase}
        disabled={!isAvailable || isLoading || !productsConfigured}
        style={[
          styles.purchaseButton,
          { backgroundColor: colors.primary },
          (!isAvailable || isLoading || !productsConfigured) && { opacity: 0.4 },
        ]}
      >
        <ThemedText style={{ color: colors.primaryText, fontWeight: '700' }}>
          {isLoading ? '読み込み中…' : '購入する'}
        </ThemedText>
      </Pressable>
      {!productsConfigured || !isAvailable ? (
        <ThemedText variant="caption" color="muted" style={styles.purchaseNote}>
          {isLoading
            ? '課金機能の状態を確認しています…'
            : !isAvailable
              ? '⚠ 課金機能がこのビルドで有効になっていません (RevenueCat の API キー未設定またはネイティブ SDK 未同梱)。無料版としてご利用いただけます。'
              : '⚠ ストア側のサブスクリプション商品がまだ作成されていないため、購入は現在できません。商品の準備ができ次第、購入できるようになります。'}
        </ThemedText>
      ) : null}

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <ThemedText variant="heading">解約方法</ThemedText>
        <ThemedText variant="caption" color="muted">
          サブスクリプションは自動更新です。解約は、App Store のアカウント設定から次回更新日の
          24 時間前までに行えます。解約後も現在の契約期間の終了までは機能を利用できます。
        </ThemedText>
      </View>

      <View style={styles.legalRow}>
        <Pressable onPress={() => router.push('/legal?doc=terms')}>
          <ThemedText variant="caption" color="primary">
            利用規約
          </ThemedText>
        </Pressable>
        <Pressable onPress={() => router.push('/legal?doc=privacy')}>
          <ThemedText variant="caption" color="primary">
            プライバシーポリシー
          </ThemedText>
        </Pressable>
        <ThemedText variant="caption" color="muted">
          商品 ID: {PRODUCT_IDS.monthly} / {PRODUCT_IDS.annual}
        </ThemedText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: { marginTop: 4, marginBottom: 12 },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 6,
    marginTop: 12,
  },
  featureRow: { marginTop: 2 },
  priceRow: { fontWeight: '700' },
  purchaseButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  purchaseNote: { marginTop: 8, lineHeight: 18 },
  legalRow: { flexDirection: 'row', gap: 16, alignItems: 'center', marginTop: 16, flexWrap: 'wrap' },
});
