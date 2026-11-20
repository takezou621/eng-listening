import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Chip } from '@/components/Chip';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { CONTENTS } from '@/data';
import { CONTENT_TYPE_LABELS, type ContentType } from '@/data/types';
import { getLessonList } from '@/features/lesson/registry';
import { useSelection } from '@/state/SelectionContext';
import { useTheme } from '@/theme/AppThemeProvider';

type Filter = 'all' | ContentType;

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'すべて' },
  { value: 'conversation', label: '会話' },
  { value: 'monologue', label: 'モノローグ' },
];

/** ホーム = コンテンツライブラリ (モック 12 本 + パイプライン生成レッスン 12 本) */
export default function LibraryScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { selected, select } = useSelection();
  const [filter, setFilter] = useState<Filter>('all');
  const lessonList = getLessonList();

  const contents = filter === 'all' ? CONTENTS : CONTENTS.filter((c) => c.type === filter);
  const counts = {
    conversation: CONTENTS.filter((c) => c.type === 'conversation').length,
    monologue: CONTENTS.filter((c) => c.type === 'monologue').length,
  };

  return (
    // FlatList 自体がスクロールするため Screen はスクロールさせない (VirtualizedList のネスト防止)
    <Screen scroll={false}>
      <ThemedText variant="title">ライブラリ</ThemedText>
      <ThemedText variant="caption" color="muted" style={styles.subtitle}>
        全 {CONTENTS.length} 本 (会話 {counts.conversation} / モノローグ {counts.monologue}) ・ モックデータ
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
              <View style={[styles.badgeType, { backgroundColor: colors.badgeTypeBg }]}>
                <ThemedText variant="caption" style={{ color: colors.badgeTypeText }}>
                  {CONTENT_TYPE_LABELS[item.type]}
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
        ListHeaderComponent={
          <View style={styles.pipelineSection}>
            <ThemedText variant="heading">生成レッスン (12 本計画)</ThemedText>
            <ThemedText variant="caption" color="muted" style={styles.subtitle}>
              パイプライン生成 (Cloud TTS + faster-whisper)。タップで再生画面へ
            </ThemedText>
            {lessonList.map(({ entry, bundle }) => (
              <Pressable
                key={entry.id}
                disabled={bundle === null}
                onPress={() => router.push(`/lesson?lesson=${entry.id}`)}
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    opacity: bundle === null ? 0.6 : 1,
                  },
                ]}
              >
                <View style={styles.cardHeader}>
                  <View style={[styles.badgeType, { backgroundColor: colors.badgeTypeBg }]}>
                    <ThemedText variant="caption" style={{ color: colors.badgeTypeText }}>
                      {CONTENT_TYPE_LABELS[entry.type]}
                    </ThemedText>
                  </View>
                  <View style={[styles.badgeLevel, { backgroundColor: colors.secondarySurface }]}>
                    <ThemedText variant="caption" color="primary">
                      {entry.level}
                    </ThemedText>
                  </View>
                  {bundle === null && (
                    <View style={[styles.badgeLevel, { backgroundColor: colors.secondarySurface }]}>
                      <ThemedText variant="caption" color="muted">
                        準備中
                      </ThemedText>
                    </View>
                  )}
                </View>
                <ThemedText variant="heading">{entry.title}</ThemedText>
                <ThemedText variant="caption" color="muted">
                  {entry.titleJa}
                  {bundle ? ` ・ ${bundle.data.durationSec.toFixed(0)} 秒 ・ ${bundle.data.sentences.length} 文` : ''}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: { marginTop: 4 },
  filterRow: { flexDirection: 'row', gap: 8, marginVertical: 12 },
  list: { paddingBottom: 24, gap: 10 },
  pipelineSection: { marginTop: 20, gap: 10 },
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
  badgeLevel: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
});
