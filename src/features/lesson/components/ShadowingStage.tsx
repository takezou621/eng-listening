import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import type { PlaybackRate } from '@/config/appConfig';
import type { LessonSentence } from '@/features/lesson/types';
import { useTheme } from '@/theme/AppThemeProvider';

const STEPS = ['① お手本', '② 録音', '③ 聞き比べ'] as const;

/**
 * 1文フォーカス形式のシャドーイングステージ (Issue #45 / E18)。
 * - シャドテン型: 3 ステップの固定表示で迷いをなくす
 * - スピークバディ型: 「英文を隠す」トグルで段階的に支えを外す
 * - Speak / ELSA 型: お手本再生 → 自動録音 → 連続聞き比べを 1 カードに集約
 */
export function ShadowingStage({
  sentence,
  speakerName,
  isWeak,
  onToggleWeak,
  recordingCount,
  isRecording,
  recordingElapsedSec,
  isPendingRecord,
  autoRecordAfterModel,
  hasUserRecording,
  userRecordingDurationSec,
  comparingSource,
  isCompareActive,
  micDenied,
  recorderError,
  onPlayModel,
  onPlayUser,
  onCompareSequential,
}: {
  sentence: LessonSentence;
  speakerName: string;
  isWeak: boolean;
  onToggleWeak: () => void;
  recordingCount: number;
  isRecording: boolean;
  recordingElapsedSec: number;
  isPendingRecord: boolean;
  autoRecordAfterModel: boolean;
  hasUserRecording: boolean;
  userRecordingDurationSec: number;
  comparingSource: 'model' | 'user' | null;
  isCompareActive: boolean;
  micDenied: boolean;
  recorderError: string | null;
  onPlayModel: () => void;
  onPlayUser: () => void;
  onCompareSequential: () => void;
}) {
  const { scheme, colors } = useTheme();
  const [hideText, setHideText] = useState(false);
  const [peekText, setPeekText] = useState(false);

  // 文が変わったら「一時表示」は解除する (次の文が最初から見えてしまうのを防ぐ)。
  // props 変化に応じた state 調整パターン (レンダー中に前回値を比較する)
  const [peekSentenceIndex, setPeekSentenceIndex] = useState(sentence.index);
  if (peekSentenceIndex !== sentence.index) {
    setPeekSentenceIndex(sentence.index);
    setPeekText(false);
  }

  const dangerColor = scheme === 'dark' ? '#F87171' : '#DC2626';
  const weakActiveColor = scheme === 'dark' ? '#FBBF24' : '#B45309';

  const currentStep = isRecording
    ? 1
    : isPendingRecord
      ? 0
      : hasUserRecording || isCompareActive
        ? 2
        : 0;

  const showEnglish = !hideText || peekText;

  return (
    <View style={styles.container}>
      {/* ブロック 1: 3ステップ手順固定バー */}
      <View
        style={[
          styles.stepBar,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        {STEPS.map((label, idx) => {
          const isCurrent = idx === currentStep;
          const isDone = idx < currentStep || (idx === 1 && hasUserRecording && !isRecording);
          return (
            <View
              key={label}
              style={[
                styles.stepItem,
                isCurrent && { backgroundColor: colors.secondarySurface },
              ]}
            >
              <ThemedText
                variant="caption"
                style={[
                  styles.stepText,
                  {
                    color: isCurrent
                      ? colors.primary
                      : isDone
                        ? colors.text
                        : colors.textMuted,
                  },
                ]}
              >
                {label}
              </ThemedText>
            </View>
          );
        })}
      </View>

      {/* ブロック 2: 1文フォーカスカード */}
      <View
        style={[
          styles.focusCard,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View style={styles.cardTopRow}>
          <View style={styles.speakerGroup}>
            <ThemedText variant="caption" color="muted" style={styles.speakerText}>
              {speakerName}
            </ThemedText>
            {recordingCount > 0 ? (
              <View style={[styles.countPill, { backgroundColor: colors.secondarySurface }]}>
                <ThemedText variant="caption" color="primary" style={styles.countText}>
                  録音 {recordingCount}回
                </ThemedText>
              </View>
            ) : null}
          </View>
          <View style={styles.topActions}>
            <Pressable
              onPress={() => {
                setHideText((prev) => !prev);
                setPeekText(false);
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={hideText ? '英文を表示' : '英文を隠す'}
            >
              <ThemedText variant="caption" color="primary" style={styles.topActionText}>
                {hideText ? '英文を表示' : '英文を隠す'}
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={onToggleWeak}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={isWeak ? '苦手フレーズから外す' : '苦手フレーズに登録'}
            >
              <ThemedText
                variant="caption"
                style={{ color: isWeak ? weakActiveColor : colors.textMuted, fontWeight: '600' }}
              >
                {isWeak ? '★ 苦手' : '☆ 苦手'}
              </ThemedText>
            </Pressable>
          </View>
        </View>

        {showEnglish ? (
          <Pressable
            disabled={!hideText}
            onPress={() => setPeekText(false)}
            style={styles.sentenceBox}
          >
            <ThemedText style={styles.sentenceEnglish}>{sentence.text}</ThemedText>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => setPeekText(true)}
            style={[
              styles.hiddenBox,
              { borderColor: colors.border, backgroundColor: colors.secondarySurface },
            ]}
            accessibilityRole="button"
            accessibilityLabel="隠した英文を一時表示"
          >
            <ThemedText variant="caption" color="primary" style={styles.hiddenLabel}>
              英文を隠しています（タップで表示）
            </ThemedText>
          </Pressable>
        )}

        <ThemedText variant="caption" color="muted" style={styles.translation}>
          {sentence.translationJa}
        </ThemedText>

        {isRecording ? (
          <View style={[styles.statusBanner, { borderColor: dangerColor }]}>
            <View style={styles.recordingStatusRow}>
              <View style={[styles.recDot, { backgroundColor: dangerColor }]} />
              <ThemedText variant="caption" style={{ color: dangerColor, fontWeight: '700' }}>
                録音中 {recordingElapsedSec.toFixed(1)} 秒 — 話し終えたら下の停止を押してください
              </ThemedText>
            </View>
          </View>
        ) : isPendingRecord ? (
          <View style={[styles.statusBanner, { borderColor: colors.primary }]}>
            <ThemedText variant="caption" color="primary" style={styles.statusText}>
              🔊 お手本を再生中… 終わると自動で録音が始まります
            </ThemedText>
          </View>
        ) : micDenied ? (
          <ThemedText variant="caption" style={{ color: dangerColor }}>
            マイク権限が拒否されています。iOS 設定 &gt; プライバシーとセキュリティ &gt; マイクで許可してください。
          </ThemedText>
        ) : recorderError ? (
          <ThemedText variant="caption" style={{ color: dangerColor }}>
            録音エラーが発生しました: {recorderError}
          </ThemedText>
        ) : null}

        <View style={styles.compareRow}>
          <Pressable
            onPress={onPlayModel}
            disabled={isRecording}
            style={[
              styles.secondaryButton,
              {
                borderColor:
                  comparingSource === 'model' && isCompareActive ? colors.primary : colors.border,
                backgroundColor:
                  comparingSource === 'model' && isCompareActive
                    ? colors.secondarySurface
                    : colors.surface,
              },
              isRecording && styles.disabledButton,
            ]}
            accessibilityRole="button"
            accessibilityLabel="お手本を再生"
          >
            <ThemedText
              variant="caption"
              color={comparingSource === 'model' && isCompareActive ? 'primary' : 'default'}
              style={styles.secondaryLabel}
            >
              🔊 お手本
            </ThemedText>
          </Pressable>

          {hasUserRecording ? (
            <>
              <Pressable
                onPress={onPlayUser}
                disabled={isRecording || isPendingRecord}
                style={[
                  styles.secondaryButton,
                  {
                    borderColor:
                      comparingSource === 'user' && isCompareActive
                        ? colors.primary
                        : colors.border,
                    backgroundColor:
                      comparingSource === 'user' && isCompareActive
                        ? colors.secondarySurface
                        : colors.surface,
                  },
                  (isRecording || isPendingRecord) && styles.disabledButton,
                ]}
                accessibilityRole="button"
                accessibilityLabel="自分の録音を再生"
              >
                <ThemedText
                  variant="caption"
                  color={comparingSource === 'user' && isCompareActive ? 'primary' : 'default'}
                  style={styles.secondaryLabel}
                >
                  🎤 自分の声 ({userRecordingDurationSec.toFixed(1)}秒)
                </ThemedText>
              </Pressable>

              <Pressable
                onPress={onCompareSequential}
                disabled={isRecording || isPendingRecord}
                style={[
                  styles.secondaryButton,
                  { borderColor: colors.primary, backgroundColor: colors.secondarySurface },
                  (isRecording || isPendingRecord) && styles.disabledButton,
                ]}
                accessibilityRole="button"
                accessibilityLabel="お手本と自分の声を連続で聞き比べ"
              >
                <ThemedText variant="caption" color="primary" style={styles.secondaryLabel}>
                  🔁 聞き比べ
                </ThemedText>
              </Pressable>
            </>
          ) : null}
        </View>

        {!hasUserRecording && !isRecording && !isPendingRecord ? (
          <ThemedText variant="caption" color="muted">
            {autoRecordAfterModel
              ? '下の「お手本 → 録音」を押すと、お手本に続いて自動録音が始まります。'
              : '下の「録音する」を押して発音し、お手本と聞き比べられます。'}
          </ThemedText>
        ) : null}
      </View>
    </View>
  );
}

/**
 * 話すモード用の下部固定バー (1段構成・プライマリボタン1つ)。
 */
export function ShadowingFooterBar({
  sentenceIndex,
  sentenceCount,
  rate,
  isRecording,
  recordingElapsedSec,
  isPendingRecord,
  autoRecordAfterModel,
  onOpenTools,
  onPrev,
  onNext,
  onTriggerRecord,
  onStopRecord,
}: {
  sentenceIndex: number;
  sentenceCount: number;
  rate: PlaybackRate;
  isRecording: boolean;
  recordingElapsedSec: number;
  isPendingRecord: boolean;
  autoRecordAfterModel: boolean;
  onOpenTools: () => void;
  onPrev: () => void;
  onNext: () => void;
  onTriggerRecord: () => void;
  onStopRecord: () => void;
}) {
  const { scheme, colors } = useTheme();
  const canPrev = sentenceIndex > 0 && !isRecording;
  const canNext = sentenceIndex < sentenceCount - 1 && !isRecording;
  const dangerBg = scheme === 'dark' ? '#EF4444' : '#DC2626';

  return (
    <View
      style={[
        styles.footerBar,
        { backgroundColor: colors.surface, borderTopColor: colors.border },
      ]}
    >
      <View style={styles.footerRow}>
        <Pressable
          onPress={onOpenTools}
          disabled={isRecording}
          style={[
            styles.toolButton,
            { borderColor: rate !== 1.0 ? colors.primary : colors.border },
            isRecording && styles.disabledButton,
          ]}
          accessibilityRole="button"
          accessibilityLabel="再生速度と練習設定"
        >
          <ThemedText
            variant="caption"
            color={rate !== 1.0 ? 'primary' : 'default'}
            style={styles.toolLabel}
          >
            {rate}x
          </ThemedText>
        </Pressable>

        <Pressable
          onPress={onPrev}
          disabled={!canPrev}
          style={[
            styles.navButton,
            { backgroundColor: colors.secondarySurface },
            !canPrev && styles.disabledButton,
          ]}
          accessibilityRole="button"
          accessibilityLabel="前の文"
        >
          <ThemedText style={styles.navLabel}>⏮</ThemedText>
        </Pressable>

        {isRecording ? (
          <Pressable
            onPress={onStopRecord}
            style={[styles.primaryAction, { backgroundColor: dangerBg }]}
            accessibilityRole="button"
            accessibilityLabel="録音停止"
          >
            <ThemedText style={{ color: '#FFFFFF', fontWeight: '700' }}>
              ⏹ 録音停止 ({recordingElapsedSec.toFixed(1)}s)
            </ThemedText>
          </Pressable>
        ) : (
          <Pressable
            onPress={onTriggerRecord}
            style={[styles.primaryAction, { backgroundColor: colors.primary }]}
            accessibilityRole="button"
            accessibilityLabel={
              isPendingRecord
                ? '録音予約を取り消す'
                : autoRecordAfterModel
                  ? 'お手本再生後に録音開始'
                  : '録音する'
            }
          >
            <ThemedText style={{ color: colors.primaryText, fontWeight: '700' }}>
              {isPendingRecord
                ? '🔊 お手本再生中（取消）'
                : autoRecordAfterModel
                  ? '🎙 お手本 → 録音'
                  : '🎙 録音する'}
            </ThemedText>
          </Pressable>
        )}

        <Pressable
          onPress={onNext}
          disabled={!canNext}
          style={[
            styles.navButton,
            { backgroundColor: colors.secondarySurface },
            !canNext && styles.disabledButton,
          ]}
          accessibilityRole="button"
          accessibilityLabel="次の文"
        >
          <ThemedText style={styles.navLabel}>⏭</ThemedText>
        </Pressable>
      </View>

      <ThemedText variant="caption" color="muted" style={styles.footerMeta}>
        文 {sentenceIndex + 1} / {sentenceCount}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  stepBar: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  stepItem: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  stepText: {
    fontWeight: '600',
  },
  focusCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  speakerGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  speakerText: {
    fontWeight: '600',
  },
  countPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countText: {
    fontWeight: '600',
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  topActionText: {
    fontWeight: '600',
  },
  sentenceBox: {
    paddingVertical: 8,
  },
  sentenceEnglish: {
    fontSize: 20,
    lineHeight: 30,
    fontWeight: '600',
  },
  hiddenBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hiddenLabel: {
    fontWeight: '600',
  },
  translation: {
    lineHeight: 19,
  },
  statusBanner: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  recordingStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontWeight: '600',
  },
  compareRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  secondaryButton: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 40,
    justifyContent: 'center',
  },
  secondaryLabel: {
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.4,
  },
  footerBar: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    gap: 6,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toolButton: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolLabel: {
    fontWeight: '700',
  },
  navButton: {
    borderRadius: 999,
    paddingHorizontal: 12,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLabel: {
    fontWeight: '600',
  },
  primaryAction: {
    flex: 1,
    borderRadius: 999,
    minHeight: 44,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerMeta: {
    textAlign: 'center',
  },
});
