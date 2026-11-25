import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { Chip } from '@/components/Chip';
import { ThemedText } from '@/components/ThemedText';
import {
  CURRICULUM_FOCUS_TYPES,
  MAX_CURRICULUM_FOCUS_TYPES,
  isCurriculumCustomizationActive,
  type CurriculumLevelFilter,
  type LinkingNoteType,
} from '@/features/learning/curriculum';
import { LINKING_LABELS, LINKING_SYMBOLS } from '@/features/lesson/linkingViz';

const LEVEL_CHIPS: readonly { value: CurriculumLevelFilter; label: string }[] = [
  { value: 'all', label: 'ぜんぶ' },
  { value: 'beginner', label: '初級' },
  { value: 'intermediate', label: '中級' },
];

/**
 * カリキュラムの手動カスタマイズ (重点タイプ・難易度) ボトムシート (Issue #106)。
 * 既存部品 (Chip / BottomSheet / ThemedText) のみで構成し、
 * 選ばない項目は自動のおすすめに従う (ゼロ設定の既定動作は変えない)。
 */
export function CurriculumCustomizeSheet({
  visible,
  focusTypes,
  levelFilter,
  onToggleType,
  onClearTypes,
  onSetLevel,
  onResetAll,
  onClose,
}: {
  visible: boolean;
  focusTypes: LinkingNoteType[];
  levelFilter: CurriculumLevelFilter;
  onToggleType: (type: LinkingNoteType) => void;
  onClearTypes: () => void;
  onSetLevel: (level: CurriculumLevelFilter) => void;
  onResetAll: () => void;
  onClose: () => void;
}) {
  const isMaxSelected = focusTypes.length >= MAX_CURRICULUM_FOCUS_TYPES;
  const isCustomActive = isCurriculumCustomizationActive({ focusTypes, levelFilter });

  return (
    <BottomSheet visible={visible} title="カリキュラムを調整" onClose={onClose}>
      <ThemedText variant="caption" color="muted">
        重点的に練習する音変化と難易度を選べます。選ばない項目は自動のおすすめに従います。
      </ThemedText>

      <View style={styles.fieldRow}>
        <ThemedText variant="caption" color="muted" style={styles.fieldLabel}>
          音変化
        </ThemedText>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipScroll}
          contentContainerStyle={styles.chipContent}
        >
          <Chip
            label="おまかせ"
            variant="outlined"
            active={focusTypes.length === 0}
            onPress={onClearTypes}
          />
          {CURRICULUM_FOCUS_TYPES.map((type) => {
            const selected = focusTypes.includes(type);
            return (
              <Chip
                key={type}
                label={`${LINKING_SYMBOLS[type]} ${LINKING_LABELS[type]}`}
                variant="outlined"
                active={selected}
                disabled={isMaxSelected && !selected}
                onPress={() => onToggleType(type)}
              />
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.fieldRow}>
        <ThemedText variant="caption" color="muted" style={styles.fieldLabel}>
          難易度
        </ThemedText>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipScroll}
          contentContainerStyle={styles.chipContent}
        >
          {LEVEL_CHIPS.map(({ value, label }) => (
            <Chip
              key={value}
              label={label}
              variant="outlined"
              active={levelFilter === value}
              onPress={() => onSetLevel(value)}
            />
          ))}
        </ScrollView>
      </View>

      {isCustomActive ? (
        <Pressable
          onPress={onResetAll}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="カリキュラムをおまかせに戻す"
          style={styles.resetBtn}
        >
          <ThemedText color="primary" style={styles.resetText}>
            おまかせに戻す
          </ThemedText>
        </Pressable>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fieldLabel: {
    width: 48,
    flexShrink: 0,
  },
  chipScroll: {
    flex: 1,
  },
  chipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resetBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  resetText: {
    fontWeight: '700',
  },
});
