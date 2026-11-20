import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { DISPLAY_PRICES } from '@/features/billing/config';
import {
  fetchOfferingsAsync,
  initBillingAsync,
  purchaseAsync,
  restorePurchasesAsync,
  useEntitlement,
  type PurchaseResult,
  type RestoreResult,
} from '@/features/billing/billingStore';
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
  const [hasProducts, setHasProducts] = useState(false);
  const [monthlyProductId, setMonthlyProductId] = useState<string | null>(null);
  const [annualProductId, setAnnualProductId] = useState<string | null>(null);
  // 選択中のプラン ('monthly' | 'annual')。既定は年額 (GM 決定の主力プラン)
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('annual');
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    void initBillingAsync();
    // ペイウォール表示を分析ログに記録 (端末内のみ)
    logEvent('paywall_viewed', { from: fromParam ?? 'settings' });
  }, [fromParam]);

  // Offerings から購入可能な商品を取得する (ストア側に実商品がある場合のみ商品が返る)
  useEffect(() => {
    if (!isAvailable) return;
    void fetchOfferingsAsync().then((result) => {
      setHasProducts(result.hasProducts);
      setMonthlyProductId(result.monthlyProductId);
      setAnnualProductId(result.annualProductId);
      // 既定の年額プランが Offerings にない場合は月額にフォールバックする
      if (!result.annualProductId && result.monthlyProductId) {
        setSelectedPlan('monthly');
      }
    });
  }, [isAvailable]);

  // 選択中プランのストア商品 ID (Offerings から取得できていない場合は null)
  const selectedProductId =
    selectedPlan === 'monthly' ? monthlyProductId : annualProductId;
  // 復元中 (restoring) は購入を開始できないようにする (購入と復元の競合防止)
  const canPurchase =
    isAvailable &&
    hasProducts &&
    !purchasing &&
    !restoring &&
    !isPremium &&
    selectedProductId !== null;

  const purchaseNote = getPurchaseNote({
    isLoading,
    purchasing,
    isPremium,
    isAvailable,
    hasProducts,
  });

  const [purchaseMessage, setPurchaseMessage] = useState('');

  const handlePurchase = async () => {
    // 実購入: RevenueCat の purchaseProduct → 購入成功時のみ purchase_completed を発火する
    if (!canPurchase || !selectedProductId) return;
    setPurchasing(true);
    const result: PurchaseResult = await purchaseAsync(selectedProductId);
    setPurchasing(false);
    if (result.purchased) {
      setPurchaseMessage('プレミアムへの切り替えが完了しました。');
      logEvent('purchase_completed', {
        productId: selectedProductId,
        premium_active: result.premium,
      });
    } else if (result.reason === 'error') {
      // ユーザーによるキャンセルはメッセージを出さない (エラーのみ案内)
      setPurchaseMessage('購入に失敗しました。時間をおいて再度お試しください。');
    }
  };

  const [restoreMessage, setRestoreMessage] = useState('');

  const handleRestore = async () => {
    if (!isAvailable) return;
    setRestoring(true);
    const result: RestoreResult = await restorePurchasesAsync();
    setRestoring(false);
    if (result.restored && result.premium) {
      // 復元成功かつプレミアムが有効な場合のみ購入完了として記録する
      logEvent('purchase_completed', {
        productId: 'restored',
        restored: true,
        premium_active: true,
      });
      setRestoreMessage('プレミアムが復元されました。');
    } else if (result.restored) {
      // 復元処理は成功したが、プレミアム購入が見つからない場合
      setRestoreMessage('復元できるプレミアム購入が見つかりませんでした。');
    } else {
      setRestoreMessage('復元に失敗しました。時間をおいて再度お試しください。');
    }
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
        <Pressable
          onPress={() => setSelectedPlan('monthly')}
          disabled={!monthlyProductId}
          accessibilityRole="button"
          accessibilityState={{ selected: selectedPlan === 'monthly' }}
          style={[
            styles.planButton,
            { borderColor: colors.border },
            selectedPlan === 'monthly' && { borderColor: colors.primary, borderWidth: 2 },
            !monthlyProductId && { opacity: 0.5 },
          ]}
        >
          <ThemedText style={styles.priceRow}>{DISPLAY_PRICES.monthlyJa}</ThemedText>
          <ThemedText variant="caption" color="muted">
            自動更新。いつでも解約できます。
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={() => setSelectedPlan('annual')}
          disabled={!annualProductId}
          accessibilityRole="button"
          accessibilityState={{ selected: selectedPlan === 'annual' }}
          style={[
            styles.planButton,
            { borderColor: colors.border },
            selectedPlan === 'annual' && { borderColor: colors.primary, borderWidth: 2 },
            !annualProductId && { opacity: 0.5 },
          ]}
        >
          <ThemedText style={styles.priceRow}>{DISPLAY_PRICES.annualJa}</ThemedText>
          <ThemedText variant="caption" color="muted">
            トライアル期間中に解約すれば請求されません。
          </ThemedText>
        </Pressable>
      </View>

      {/* ストア商品が取得できない環境では購入ボタンを無効化 (理由を画面上に表示) */}
      <Pressable
        onPress={handlePurchase}
        disabled={!canPurchase}
        style={[
          styles.purchaseButton,
          { backgroundColor: colors.primary },
          !canPurchase && { opacity: 0.4 },
        ]}
      >
        <ThemedText style={{ color: colors.primaryText, fontWeight: '700' }}>
          {isLoading || purchasing ? '読み込み中…' : isPremium ? 'プレミアム済み' : '購入する'}
        </ThemedText>
      </Pressable>
      {!canPurchase && purchaseNote ? (
        <ThemedText variant="caption" color="muted" style={styles.purchaseNote}>
          {purchaseNote}
        </ThemedText>
      ) : null}

      <Pressable
        onPress={handleRestore}
        disabled={!isAvailable || isLoading || purchasing || restoring}
        style={styles.restoreButton}
      >
        <ThemedText variant="caption" color="primary">
          {restoring ? '復元中…' : '購入を復元'}
        </ThemedText>
      </Pressable>
      {restoreMessage ? (
        <ThemedText variant="caption" color="muted" style={styles.purchaseNote}>
          {restoreMessage}
        </ThemedText>
      ) : null}
      {purchaseMessage ? (
        <ThemedText variant="caption" color="muted" style={styles.purchaseNote}>
          {purchaseMessage}
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
        <Pressable onPress={() => router.push('/legal?doc=tokushoho')}>
          <ThemedText variant="caption" color="primary">
            特定商取引法に基づく表記
          </ThemedText>
        </Pressable>
      </View>
    </Screen>
  );
}

function getPurchaseNote(state: {
  isLoading: boolean;
  purchasing: boolean;
  isPremium: boolean;
  isAvailable: boolean;
  hasProducts: boolean;
}): string {
  const { isLoading, purchasing, isPremium, isAvailable, hasProducts } = state;
  if (isLoading || purchasing) return '課金機能の状態を確認しています…';
  if (isPremium) return 'プレミアムエンタイトルメントが有効です。';
  if (!isAvailable) {
    return '⚠ 課金機能がこのビルドで有効になっていません (RevenueCat の API キー未設定またはネイティブ SDK 未同梱)。無料版としてご利用いただけます。';
  }
  if (!hasProducts) {
    return '⚠ ストア側のサブスクリプション商品がまだ作成されていないため、購入は現在できません。商品の準備ができ次第、購入できるようになります。';
  }
  return '';
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
  planButton: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginTop: 8,
  },
  purchaseNote: { marginTop: 8, lineHeight: 18 },
  restoreButton: { alignItems: 'center', marginTop: 10, padding: 8 },
  legalRow: { flexDirection: 'row', gap: 16, alignItems: 'center', marginTop: 16, flexWrap: 'wrap' },
});
