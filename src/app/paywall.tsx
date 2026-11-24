import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
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
import { LESSON_CATALOG } from '@/features/lesson/registry';
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
  `全 ${LESSON_CATALOG.length} レッスンの再生・カラオケ風表示・AB リピート`,
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
  // 表示価格はストアの実価格を優先する (コード内の固定文字列はフォールバック)
  const [monthlyPriceString, setMonthlyPriceString] = useState<string | null>(null);
  const [annualPriceString, setAnnualPriceString] = useState<string | null>(null);
  // 数値価格 (計測の purchase_completed の value 用)
  const [monthlyPrice, setMonthlyPrice] = useState<number | null>(null);
  const [annualPrice, setAnnualPrice] = useState<number | null>(null);
  const [annualPerMonthString, setAnnualPerMonthString] = useState<string | null>(null);
  const [annualHasFreeTrial, setAnnualHasFreeTrial] = useState(false);
  // 選択中のプラン ('monthly' | 'annual')。既定は年額 (GM 決定の主力プラン)
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('annual');
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  // 購入/復元の結果メッセージ (1 つの state に統一し、矛盾するメッセージの併存を防ぐ)
  const [resultMessage, setResultMessage] = useState('');

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
      setMonthlyPriceString(result.monthlyPriceString);
      setAnnualPriceString(result.annualPriceString);
      setMonthlyPrice(result.monthlyPrice);
      setAnnualPrice(result.annualPrice);
      setAnnualPerMonthString(result.annualPerMonthString);
      setAnnualHasFreeTrial(result.annualHasFreeTrial);
      // 既定の年額プランが Offerings にない場合は月額にフォールバックする
      if (!result.annualProductId && result.monthlyProductId) {
        setSelectedPlan('monthly');
      }
    });
  }, [isAvailable]);

  // プラン選択 (ユーザーのタップ時のみ。計測イベントもここでのみ発火する)
  const selectPlan = (plan: 'monthly' | 'annual') => {
    setSelectedPlan(plan);
    logEvent('paywall_plan_selected', { plan });
  };

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

  const handlePurchase = async () => {
    // 実購入: RevenueCat の purchaseProduct → 購入成功時のみ purchase_completed を発火する
    if (!canPurchase || !selectedProductId) return;
    // 結果メッセージは 1 つの state で管理するため、開始時に前回の結果を消す
    setResultMessage('');
    setPurchasing(true);
    logEvent('purchase_started', { productId: selectedProductId });
    const result: PurchaseResult = await purchaseAsync(selectedProductId);
    setPurchasing(false);
    if (result.purchased) {
      setResultMessage('プレミアムへの切り替えが完了しました。');
      const selectedPrice = selectedPlan === 'monthly' ? monthlyPrice : annualPrice;
      logEvent('purchase_completed', {
        productId: selectedProductId,
        ...(selectedPrice !== null ? { value: selectedPrice } : {}),
        currency: 'JPY',
        premium_active: result.premium,
      });
    } else {
      // 失敗理由は粗い分類のみ記録する (生のエラー文は個人情報を含みうるため送らない)
      const failReason =
        result.reason === 'cancelled'
          ? 'user_cancelled'
          : result.errorCode === '10'
            ? 'network'
            : result.errorCode === '8'
              ? 'store_error'
              : 'unknown';
      logEvent('purchase_failed', { productId: selectedProductId, reason: failReason });
    }
    if (!result.purchased && result.reason === 'error') {
      // ユーザーによるキャンセルはメッセージを出さない (エラーのみ案内)
      setResultMessage('購入に失敗しました。時間をおいて再度お試しください。');
    } else if (!result.purchased) {
      // キャンセル: 前回のメッセージが残らないようクリアする
      setResultMessage('');
    }
  };

  const handleRestore = async () => {
    if (!isAvailable) return;
    // 結果メッセージは 1 つの state で管理するため、開始時に前回の結果を消す
    setResultMessage('');
    setRestoring(true);
    const result: RestoreResult = await restorePurchasesAsync();
    setRestoring(false);
    if (result.restored) {
      logEvent('restore_completed', { result: result.premium ? 'restored' : 'nothing' });
    }
    if (result.restored && result.premium) {
      // 復元成功かつプレミアムが有効な場合のみ購入完了として記録する
      logEvent('purchase_completed', {
        productId: 'restored',
        restored: true,
        premium_active: true,
      });
      setResultMessage('プレミアムが復元されました。');
    } else if (result.restored) {
      // 復元処理は成功したが、プレミアム購入が見つからない場合
      setResultMessage('復元できるプレミアム購入が見つかりませんでした。');
    } else {
      setResultMessage('復元に失敗しました。時間をおいて再度お試しください。');
    }
  };

  const annualLabel = annualPriceString ?? '¥4,800';
  const monthlyLabel = monthlyPriceString ?? '¥680';
  const trialAndRenewalSummary =
    selectedPlan === 'annual'
      ? annualHasFreeTrial
        ? `初回 7 日間無料 → 終了後は年額 ${annualLabel} で自動更新（無料体験は初回のみ対象）。iOS「設定」のサブスクリプションから次回更新日の 24 時間前までいつでも解約できます。`
        : `年額 ${annualLabel} で自動更新されます。iOS「設定」のサブスクリプションから次回更新日の 24 時間前までいつでも解約できます。`
      : `月額 ${monthlyLabel} で自動更新されます。iOS「設定」のサブスクリプションから次回更新日の 24 時間前までいつでも解約できます。`;

  return (
    <Screen hasHeader>
      <Stack.Screen
        options={{ headerShown: true, title: 'プレミアム', headerBackTitle: '戻る' }}
      />
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
          onPress={() => selectPlan('monthly')}
          disabled={!monthlyProductId}
          accessibilityRole="button"
          accessibilityState={{ selected: selectedPlan === 'monthly', disabled: !monthlyProductId }}
          style={[
            styles.planButton,
            { borderColor: colors.border },
            selectedPlan === 'monthly' && { borderColor: colors.primary, borderWidth: 2 },
            !monthlyProductId && { opacity: 0.5 },
          ]}
        >
          <ThemedText style={styles.priceRow}>
            月額 {monthlyLabel}
          </ThemedText>
          <ThemedText variant="caption" color="muted">
            自動更新・いつでも解約可（無料トライアルなし）。
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={() => selectPlan('annual')}
          disabled={!annualProductId}
          accessibilityRole="button"
          accessibilityState={{ selected: selectedPlan === 'annual', disabled: !annualProductId }}
          style={[
            styles.planButton,
            { borderColor: colors.border },
            selectedPlan === 'annual' && { borderColor: colors.primary, borderWidth: 2 },
            !annualProductId && { opacity: 0.5 },
          ]}
        >
          <ThemedText style={styles.priceRow}>
            年額 {annualLabel}
            {annualHasFreeTrial ? ' (初回 7 日間無料)' : ''}
          </ThemedText>
          <ThemedText variant="caption" color="muted">
            {annualHasFreeTrial
              ? `7日間無料 → 終了後は年額 ${annualLabel} で自動更新${annualPerMonthString ? `（月あたり約 ${annualPerMonthString}）` : ''}。期間中の解約で請求されません。`
              : `${annualPerMonthString ? `月あたり約 ${annualPerMonthString}・` : ''}自動更新・いつでも解約できます。`}
          </ThemedText>
        </Pressable>
      </View>

      {/* ストア商品が取得できない環境では購入ボタンを無効化 (理由を画面上に表示) */}
      <Pressable
        onPress={handlePurchase}
        disabled={!canPurchase}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canPurchase }}
        style={[
          styles.purchaseButton,
          { backgroundColor: colors.primary },
          !canPurchase && { opacity: 0.4 },
        ]}
      >
        <ThemedText style={{ color: colors.primaryText, fontWeight: '700' }}>
          {isLoading || purchasing
            ? '読み込み中…'
            : isPremium
              ? 'プレミアム済み'
              : selectedPlan === 'annual' && annualHasFreeTrial
                ? '7 日間無料で始める'
                : selectedPlan === 'annual'
                  ? `年額 ${annualLabel} で始める`
                  : `月額 ${monthlyLabel} で始める`}
        </ThemedText>
      </Pressable>
      <ThemedText variant="caption" color="muted" style={styles.billingSummary}>
        {trialAndRenewalSummary}
      </ThemedText>
      {!canPurchase && purchaseNote ? (
        <ThemedText variant="caption" color="muted" style={styles.purchaseNote}>
          {purchaseNote}
        </ThemedText>
      ) : null}

      <Pressable
        onPress={handleRestore}
        disabled={!isAvailable || isLoading || purchasing || restoring}
        hitSlop={{ top: 8, bottom: 8 }}
        accessibilityRole="button"
        accessibilityState={{ disabled: !isAvailable || isLoading || purchasing || restoring }}
        style={styles.restoreButton}
      >
        <ThemedText variant="caption" color="primary">
          {restoring ? '復元中…' : '購入を復元'}
        </ThemedText>
      </Pressable>
      {resultMessage ? (
        <ThemedText variant="caption" color="muted" style={styles.purchaseNote}>
          {resultMessage}
        </ThemedText>
      ) : null}

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <ThemedText variant="heading">解約方法・自動更新について</ThemedText>
        <ThemedText variant="caption" color="muted">
          iOS「設定」→「Apple Account」→「サブスクリプション」から、次回更新日の 24 時間前までいつでも解約できます。
        </ThemedText>
        <ThemedText variant="caption" color="muted">
          解約後も現在の契約期間の終了まで利用できます。無料トライアルは同一グループで初回のみ対象です。
        </ThemedText>
      </View>

      <View style={styles.legalRow}>
        <Pressable
          onPress={() => router.push('/legal?doc=terms')}
          hitSlop={{ top: 14, bottom: 14, left: 4, right: 4 }}
          accessibilityRole="button"
        >
          <ThemedText variant="caption" color="primary">
            利用規約
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={() => router.push('/legal?doc=privacy')}
          hitSlop={{ top: 14, bottom: 14, left: 4, right: 4 }}
          accessibilityRole="button"
        >
          <ThemedText variant="caption" color="primary">
            プライバシーポリシー
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={() => router.push('/legal?doc=tokushoho')}
          hitSlop={{ top: 14, bottom: 14, left: 4, right: 4 }}
          accessibilityRole="button"
        >
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
  if (isLoading || purchasing || isPremium) return '';
  if (!isAvailable) {
    return '現在、この端末では購入手続きを利用できません。無料版としてご利用いただけます。';
  }
  if (!hasProducts) {
    return '現在、購入の受付を準備中です。開始まで今しばらくお待ちください。';
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
  billingSummary: { marginTop: 8, lineHeight: 18 },
  purchaseNote: { marginTop: 8, lineHeight: 18 },
  restoreButton: { alignItems: 'center', marginTop: 10, padding: 8 },
  legalRow: { flexDirection: 'row', gap: 16, alignItems: 'center', marginTop: 16, flexWrap: 'wrap' },
});
