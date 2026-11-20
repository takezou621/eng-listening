import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { Chip } from '@/components/Chip';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { CONTENTS } from '@/data';
import type { ContentType } from '@/data/types';
import { useSelection } from '@/state/SelectionContext';
import { useTheme } from '@/theme/AppThemeProvider';

type Filter = 'all' | ContentType;

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'すべて' },
  { value: 'conversation', label: '会話' },
  { value: 'monologue', label: 'モノローグ' },
];

/** ホーム = コンテンツライブラリ (モック 12 本: 会話8 + モノローグ4) */
export default function LibraryScreen() {
  const { colors } = useTheme();
  const { selected, select } = useSelection();
  const [filter, setFilter] = useState<Filter>('all');

  const contents = filter === 'all' ? CONTENTS : CONTENTS.filter((c) => c.type === filter);

  return (
    // FlatList 自体がスクロールするため Screen はスクロールさせない (VirtualizedList のネスト防止)
    <Screen scroll={false}>
      <ThemedText variant="title">ライブラリ</ThemedText>
      <ThemedText variant="caption" color="muted" style={styles.subtitle}>
        全 {CONTENTS.length} 本 (会話 8 / モノローグ 4) ・ モックデータ
      </ThemedText>
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <Chip
            key={f.value}
            label={f.label}
            active={filter === f.value}
            onPress={() => setFilter(f.value)}
          />
        ))}
      </View>
      <FlatList
        data={contents}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => select(item.id)}
            style={[
              styles.card,
              {
                backgroundColor: colors.surface,
                borderColor: item.id === selected.id ? colors.primary : colors.border,
              },
            ]}
          >
            <View style={styles.cardHeader}>
              <View style={styles.badgeType}>
                <ThemedText variant="caption" style={styles.badgeTypeText}>
                  {item.type === 'conversation' ? '会話' : 'モノローグ'}
                </ThemedText>
              </View>
              <View style={[styles.badgeLevel, { backgroundColor: colors.secondarySurface }]}>
                <ThemedText variant="caption" color="primary">
                  {item.level}
                </ThemedText>
              </View>
              {item.audioSource === null && (
                <ThemedText variant="caption" color="muted">
                  音声未接続
                </ThemedText>
              )}
            </View>
            <ThemedText variant="heading">{item.title}</ThemedText>
            <ThemedText variant="caption" color="muted">
              {item.titleJa} ・ 約 {item.durationSec} 秒 ・{' '}
              {item.sentences.length > 0
                ? `${item.sentences.length} 文`
                : 'スクリプト未生成'}
            </ThemedText>
          </Pressable>
        )}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<ThemedText>コンテンツがありません</ThemedText>}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: { marginTop: 4 },
  filterRow: { flexDirection: 'row', gap: 8, marginVertical: 12 },
  list: { paddingBottom: 24, gap: 10 },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badgeType: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#DBEAFE',
  },
  badgeTypeText: { color: '#1D4ED8' },
  badgeLevel: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
});
