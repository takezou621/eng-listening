import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { Chip } from '@/components/Chip';
import { ThemedText } from '@/components/ThemedText';
import { PLAYBACK_RATES, type PlaybackRate } from '@/config/appConfig';
import {
  LINKING_DESCRIPTIONS,
  LINKING_LABELS,
  LINKING_TEXT_DECORATIONS,
  getLinkingColor,
} from '@/features/lesson/linkingViz';
import type { LessonLinkingNote, LessonSentence } from '@/features/lesson/types';
import { formatTime } from '@/features/player/shared';
import { useTheme } from '@/theme/AppThemeProvider';

/**
 * 音変化の解説ボトムシート (D6 解消: 常設解説カードを廃しタップ時に展開)。
 */
export function LinkingNoteSheet({
  visible,
  sentence,
  noteIndex,
  onSelectNote,
  onReplaySentence,
  onOpenLegend,
  onClose,
}: {
  visible: boolean;
  sentence: LessonSentence | null;
  noteIndex: number;
  onSelectNote: (index: number) => void;
  onReplaySentence: () => void;
  onOpenLegend: () => void;
  onClose: () => void;
}) {
  const { scheme, colors } = useTheme();
  const notes = sentence?.linking ?? [];
  const safeIndex = noteIndex >= 0 && noteIndex < notes.length ? noteIndex : 0;
  const note = notes[safeIndex] ?? null;
  const noteColor = note ? getLinkingColor(note.type, scheme) : colors.primary;

  return (
    <BottomSheet visible={visible && note !== null} title="音の変化の解説" onClose={onClose}>
      {note ? (
        <>
          {notes.length > 1 ? (
            <View style={styles.chipRow}>
              {notes.map((n, idx) => (
                <Chip
                  key={`${idx}-${n.span}`}
                  label={n.span}
                  active={idx === safeIndex}
                  onPress={() => onSelectNote(idx)}
                />
              ))}
            </View>
          ) : null}

          <View style={[styles.noteCard, { backgroundColor: colors.secondarySurface, borderColor: colors.border }]}>
            <View style={styles.badgeRow}>
              <View style={[styles.dot, { backgroundColor: noteColor }]} />
              <ThemedText
                variant="caption"
                style={[
                  styles.badgeText,
                  { color: noteColor, textDecorationColor: noteColor },
                  LINKING_TEXT_DECORATIONS[note.type],
                ]}
              >
                {LINKING_LABELS[note.type]}
              </ThemedText>
              <ThemedText variant="caption" color="muted">
                {note.ipa}
              </ThemedText>
            </View>
            <ThemedText variant="heading">{note.span}</ThemedText>
            <ThemedText>{note.noteJa}</ThemedText>
          </View>

          <Pressable
            onPress={() => {
              onReplaySentence();
              onClose();
            }}
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            accessibilityRole="button"
            accessibilityLabel="この文をもう一度聞く"
          >
            <ThemedText style={{ color: colors.primaryText, fontWeight: '700' }}>
              ▶ この文をもう一度聞く
            </ThemedText>
          </Pressable>

          <Pressable
            onPress={onOpenLegend}
            hitSlop={{ top: 8, bottom: 8 }}
            style={styles.ghostButton}
            accessibilityRole="button"
          >
            <ThemedText variant="caption" color="primary" style={styles.ghostText}>
              音変化の種類一覧（凡例）を見る ›
            </ThemedText>
          </Pressable>
        </>
      ) : null}
    </BottomSheet>
  );
}

/**
 * 音変化の凡例シート (D6 解消: 常設凡例をヘルプシートへ収納)。
 */
export function LegendSheet({
  visible,
  legendTypes,
  onClose,
}: {
  visible: boolean;
  legendTypes: LessonLinkingNote['type'][];
  onClose: () => void;
}) {
  const { scheme, colors } = useTheme();
  return (
    <BottomSheet visible={visible} title="音の変化の凡例" onClose={onClose}>
      <ThemedText variant="caption" color="muted">
        カラオケ風表示の色分けや下線の意味です。語句をタップすると詳しい解説を開きます。
      </ThemedText>
      <View style={styles.legendList}>
        {legendTypes.map((type) => {
          const typeColor = getLinkingColor(type, scheme);
          return (
            <View
              key={type}
              style={[styles.legendRow, { borderBottomColor: colors.border }]}
            >
              <View style={styles.badgeRow}>
                <View style={[styles.dot, { backgroundColor: typeColor }]} />
                <ThemedText
                  style={[
                    styles.legendLabel,
                    { color: typeColor, textDecorationColor: typeColor },
                    LINKING_TEXT_DECORATIONS[type],
                  ]}
                >
                  {LINKING_LABELS[type]}
                </ThemedText>
              </View>
              <ThemedText variant="caption" color="muted">
                {LINKING_DESCRIPTIONS[type]}
              </ThemedText>
            </View>
          );
        })}
      </View>
    </BottomSheet>
  );
}

/**
 * 再生・練習設定シート (D7 解消: 速度5ボタンと A-B リピート、自動録音設定を段階開示)。
 */
export function PlaybackToolsSheet({
  visible,
  rate,
  onSelectRate,
  ab,
  abPhrase,
  onSetAbPoint,
  onClearAb,
  autoRecordAfterModel,
  onToggleAutoRecord,
  onClose,
}: {
  visible: boolean;
  rate: PlaybackRate;
  onSelectRate: (rate: PlaybackRate) => void;
  ab: { a: number; b: number } | null;
  abPhrase: string | null;
  onSetAbPoint: (which: 'a' | 'b') => void;
  onClearAb: () => void;
  autoRecordAfterModel: boolean;
  onToggleAutoRecord: () => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  return (
    <BottomSheet visible={visible} title="再生と練習の設定" onClose={onClose}>
      <View style={styles.section}>
        <ThemedText variant="caption" color="muted" style={styles.sectionLabel}>
          再生速度
        </ThemedText>
        <View style={styles.chipRow}>
          {PLAYBACK_RATES.map((r) => (
            <Chip key={r} label={`${r}x`} active={rate === r} onPress={() => onSelectRate(r)} />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText variant="caption" color="muted" style={styles.sectionLabel}>
          区間リピート (A-B)
        </ThemedText>
        <ThemedText variant="caption" color="muted">
          現在の再生位置を A（開始）と B（終了）に設定して繰り返します。
        </ThemedText>
        <View style={styles.chipRow}>
          <Chip
            label={`A ${ab ? formatTime(ab.a) : 'を設定'}`}
            active={ab !== null}
            onPress={() => onSetAbPoint('a')}
          />
          <Chip
            label={`B ${ab ? formatTime(ab.b) : 'を設定'}`}
            active={ab !== null}
            onPress={() => onSetAbPoint('b')}
          />
          {ab !== null ? <Chip label="解除" onPress={onClearAb} /> : null}
        </View>
        {ab !== null && abPhrase ? (
          <View style={[styles.previewBox, { backgroundColor: colors.secondarySurface }]}>
            <ThemedText variant="caption" color="primary" style={styles.previewText}>
              🔁 「{abPhrase}」
            </ThemedText>
          </View>
        ) : null}
      </View>

      <View style={styles.section}>
        <ThemedText variant="caption" color="muted" style={styles.sectionLabel}>
          シャドーイング録音
        </ThemedText>
        <View style={styles.chipRow}>
          <Chip
            label={autoRecordAfterModel ? 'お手本後に自動録音: ON' : 'お手本後に自動録音: OFF'}
            active={autoRecordAfterModel}
            onPress={onToggleAutoRecord}
          />
        </View>
        <ThemedText variant="caption" color="muted">
          {autoRecordAfterModel
            ? '録音ボタンを押すと、お手本の再生後に自動で録音を始めます。'
            : '録音ボタンを押した時点ですぐに録音を始めます。'}
        </ThemedText>
      </View>
    </BottomSheet>
  );
}

/**
 * レッスン完了サマリモーダル (E1 / 提言6: 1画面完結の数値サマリ。下部再生バーとプライマリ競合させない)。
 */
export function CompletionSummaryModal({
  visible,
  summarySeconds,
  shadowingCount,
  weakCount,
  streak,
  isPremium,
  hasNextLesson,
  onNextLesson,
  onOpenPaywall,
  onClose,
}: {
  visible: boolean;
  summarySeconds: number;
  shadowingCount: number;
  weakCount: number;
  streak: number;
  isPremium: boolean;
  hasNextLesson: boolean;
  onNextLesson: () => void;
  onOpenPaywall: () => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const timeLabel =
    summarySeconds >= 90
      ? `約 ${Math.round(summarySeconds / 60)}分`
      : `${summarySeconds}秒`;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View
          style={[
            styles.summaryCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <ThemedText variant="title" style={styles.summaryTitle}>
            🎉 レッスン完了！
          </ThemedText>
          <ThemedText variant="caption" color="muted" style={styles.summarySub}>
            お疲れさまでした。今回の学習記録です。
          </ThemedText>

          <View style={styles.metricRow}>
            <View style={[styles.metricBox, { backgroundColor: colors.secondarySurface }]}>
              <ThemedText variant="caption" color="muted">
                学習時間
              </ThemedText>
              <ThemedText variant="heading" color="primary">
                {timeLabel}
              </ThemedText>
            </View>
            <View style={[styles.metricBox, { backgroundColor: colors.secondarySurface }]}>
              <ThemedText variant="caption" color="muted">
                シャドーイング
              </ThemedText>
              <ThemedText variant="heading" color="primary">
                {shadowingCount}回
              </ThemedText>
            </View>
            <View style={[styles.metricBox, { backgroundColor: colors.secondarySurface }]}>
              <ThemedText variant="caption" color="muted">
                連続学習
              </ThemedText>
              <ThemedText variant="heading" color="primary">
                {streak}日
              </ThemedText>
            </View>
          </View>

          <ThemedText variant="caption" color="muted" style={styles.summaryMeta}>
            苦手フレーズ登録: {weakCount} 件
          </ThemedText>

          {!isPremium ? (
            <Pressable
              onPress={onOpenPaywall}
              hitSlop={{ top: 14, bottom: 14 }}
              accessibilityRole="button"
            >
              <ThemedText variant="caption" color="primary" style={styles.paywallLink}>
                プレミアムでは詳細な弱点分析が見られます ›
              </ThemedText>
            </Pressable>
          ) : null}

          <View style={styles.summaryActions}>
            {hasNextLesson ? (
              <Pressable
                style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                onPress={onNextLesson}
                accessibilityRole="button"
              >
                <ThemedText style={{ color: colors.primaryText, fontWeight: '700' }}>
                  次のレッスンへ
                </ThemedText>
              </Pressable>
            ) : null}
            <Pressable
              style={
                hasNextLesson
                  ? styles.ghostButton
                  : [styles.primaryButton, { backgroundColor: colors.primary }]
              }
              hitSlop={{ top: 6, bottom: 6 }}
              onPress={onClose}
              accessibilityRole="button"
            >
              <ThemedText
                style={
                  hasNextLesson
                    ? { color: colors.primary, fontWeight: '600' }
                    : { color: colors.primaryText, fontWeight: '700' }
                }
              >
                閉じる
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  noteCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  badgeText: {
    fontWeight: '700',
  },
  primaryButton: {
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  ghostButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  ghostText: {
    fontWeight: '600',
  },
  legendList: {
    gap: 12,
  },
  legendRow: {
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  legendLabel: {
    fontWeight: '700',
  },
  section: {
    gap: 8,
  },
  sectionLabel: {
    fontWeight: '700',
  },
  previewBox: {
    borderRadius: 8,
    padding: 12,
  },
  previewText: {
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  summaryCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    gap: 12,
  },
  summaryTitle: {
    textAlign: 'center',
  },
  summarySub: {
    textAlign: 'center',
  },
  metricRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  metricBox: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  summaryMeta: {
    textAlign: 'center',
  },
  paywallLink: {
    textAlign: 'center',
  },
  summaryActions: {
    gap: 8,
    marginTop: 4,
  },
});
