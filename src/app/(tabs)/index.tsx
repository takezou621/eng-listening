import { useState, useMemo } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Chip } from '@/components/Chip';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { CONTENT_TYPE_LABELS, type ContentType } from '@/data/types';
import { getLessonList } from '@/features/lesson/registry';
import { useUserData } from '@/features/library/userStore';
import { useTheme } from '@/theme/AppThemeProvider';

type FilterType = 'all' | ContentType;
type FilterLevel = 'all' | 'beginner' | 'intermediate';

export default function LibraryScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { favoriteLessons, toggleFavoriteLesson } = useUserData();

  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterLevel, setFilterLevel] = useState<FilterLevel>('all');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  const lessonList = getLessonList();

  const filteredLessons = useMemo(() => {
    return lessonList.filter(({ entry }) => {
      if (filterType !== 'all' && entry.type !== filterType) return false;
      if (filterLevel !== 'all' && entry.level !== filterLevel) return false;
      if (showFavoritesOnly && !favoriteLessons.includes(entry.id)) return false;
      return true;
    });
  }, [lessonList, filterType, filterLevel, showFavoritesOnly, favoriteLessons]);

  const renderFilterChips = () => (
    <View style={styles.filterSection}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
        <Chip
          label="★ お気に入り"
          active={showFavoritesOnly}
          onPress={() => setShowFavoritesOnly(!showFavoritesOnly)}
        />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Chip
          label="すべて"
          active={filterType === 'all'}
          onPress={() => setFilterType('all')}
        />
        <Chip
          label="会話"
          active={filterType === 'conversation'}
          onPress={() => setFilterType('conversation')}
        />
        <Chip
          label="モノローグ"
          active={filterType === 'monologue'}
          onPress={() => setFilterType('monologue')}
        />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Chip
          label="初級"
          active={filterLevel === 'beginner'}
          onPress={() => setFilterLevel('beginner')}
        />
        <Chip
          label="中級"
          active={filterLevel === 'intermediate'}
          onPress={() => setFilterLevel('intermediate')}
        />
      </ScrollView>
    </View>
  );

  return (
    <Screen scroll={false}>
      <ThemedText variant="title">ライブラリ</ThemedText>
      <ThemedText variant="caption" color="muted" style={styles.subtitle}>
        全 {lessonList.length} 本 (生成完了)
      </ThemedText>

      {renderFilterChips()}

      <FlatList
        data={filteredLessons}
        keyExtractor={({ entry }) => entry.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<ThemedText style={styles.empty}>条件に一致するレッスンがありません</ThemedText>}
        renderItem={({ item: { entry, bundle } }) => {
          const isFav = favoriteLessons.includes(entry.id);
          return (
            <Pressable
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
                <Pressable
                  hitSlop={8}
                  onPress={() => toggleFavoriteLesson(entry.id)}
                  style={styles.favIcon}
                >
                  <ThemedText style={{ color: isFav ? '#F59E0B' : colors.textMuted, fontSize: 18 }}>
                    {isFav ? '★' : '☆'}
                  </ThemedText>
                </Pressable>
              </View>
              <ThemedText variant="heading">{entry.title}</ThemedText>
              <ThemedText variant="caption" color="muted" numberOfLines={1}>
                {entry.titleJa}
              </ThemedText>
              <ThemedText variant="caption" color="muted">
                {bundle
                  ? `約 ${bundle.data.durationSec.toFixed(0)} 秒 ・ ${bundle.data.sentences.length} 文`
                  : '準備中'}
              </ThemedText>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: { marginTop: 4, marginBottom: 12 },
  filterSection: { marginBottom: 16 },
  chipScroll: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 8 },
  divider: { width: 1, height: 24, marginHorizontal: 4 },
  list: { paddingBottom: 24, gap: 10 },
  empty: { marginTop: 24, textAlign: 'center' },
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
  },
  badgeLevel: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  favIcon: { marginLeft: 'auto' },
});
