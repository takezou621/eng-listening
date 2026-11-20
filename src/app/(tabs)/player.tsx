import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Chip } from '@/components/Chip';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { APP_CONFIG, PLAYBACK_RATES } from '@/config/appConfig';
import { sentencesOf } from '@/data';
import { useSelection } from '@/state/SelectionContext';
import { useTheme } from '@/theme/AppThemeProvider';

/** 学習プレイヤー (骨格)。実再生はオーディオスパイク画面で検証中 */
export default function PlayerScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { selected } = useSelection();
  const sentences = sentencesOf(selected);

  return (
    <Screen>
      <ThemedText variant="caption" color="muted">
        選択中のコンテンツ
      </ThemedText>
      <ThemedText variant="title" style={styles.title}>
        {selected.title}
      </ThemedText>
      <ThemedText variant="caption" color="muted">
        {selected.titleJa} ・ {selected.type === 'conversation' ? '会話' : 'モノローグ'}
      </ThemedText>

      {/* プレイヤー操作の仮配置。ボタンは次フェーズで活性化 */}
      <View style={[styles.controls, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <ThemedText variant="heading">再生コントロール (土台)</ThemedText>
        <View style={styles.rateRow}>
          {PLAYBACK_RATES.map((rate) => (
            <Chip key={rate} label={`${rate}x`} disabled={!selected.audioSource} />
          ))}
        </View>
        <ThemedText variant="caption" color="muted">
          {selected.audioSource
            ? '速度はピッチ補正ありで切り替わります (スパイク画面で動作検証済み)'
            : 'このモック項目には音声がありません。スパイク用サンプルで再生を検証できます'}
        </ThemedText>
        <Pressable
          style={[styles.spikeButton, { backgroundColor: colors.primary }]}
          onPress={() => router.push('/spike')}
        >
          <ThemedText style={{ color: colors.primaryText, fontWeight: '600' }}>
            オーディオスパイクを開く
          </ThemedText>
        </Pressable>
      </View>

      {/* スクリプト表示 (モック)。カラオケ同期は #6 で実装 */}
      <ThemedText variant="heading" style={styles.sectionTitle}>
        スクリプト ({sentences.length} 文)
      </ThemedText>
      {sentences.length === 0 ? (
        <ThemedText variant="caption" color="muted">
          このコンテンツのスクリプトはまだ生成されていません (コンテンツパイプライン #1–#3 の出力で置き換え)
        </ThemedText>
      ) : (
        sentences.map((sentence) => (
          <View
            key={sentence.index}
            style={[styles.sentence, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <ThemedText variant="caption" color="muted">
              [{sentence.startSec.toFixed(2)}s]
            </ThemedText>
            <ThemedText>{sentence.text}</ThemedText>
            <ThemedText variant="caption" color="muted">
              {sentence.translationJa}
            </ThemedText>
          </View>
        ))
      )}

      <ThemedText variant="caption" color="muted" style={styles.footer}>
        {APP_CONFIG.appName} v{APP_CONFIG.version}
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 2 },
  controls: {
    marginTop: 16,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  rateRow: { flexDirection: 'row', gap: 8 },
  spikeButton: {
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 4,
  },
  sectionTitle: { marginTop: 20 },
  sentence: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    gap: 4,
    marginTop: 8,
  },
  footer: { marginTop: 24, textAlign: 'center' },
});
