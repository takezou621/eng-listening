import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { getLessonList } from '@/features/lesson/registry';
import { useUserData } from '@/features/library/userStore';
import { useTheme } from '@/theme/AppThemeProvider';

/** 苦手フレーズ帳 */
export default function PhrasesScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { weakSentences, toggleWeakSentence } = useUserData();

  const lessonList = getLessonList();

  return (
    <Screen scroll={false}>
      <ThemedText variant="title">苦手フレーズ</ThemedText>
      <ThemedText variant="caption" color="muted" style={styles.subtitle}>
        全 {weakSentences.length} 件・タップで該当の文を開く
      </ThemedText>

      <FlatList
        data={weakSentences}
        keyExtractor={(item) => `${item.lessonId}-${item.sentenceIndex}`}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <ThemedText variant="heading">登録された苦手フレーズはありません</ThemedText>
            <ThemedText variant="caption" color="muted" style={styles.emptyHint}>
              レッスンの各文にある「☆ 苦手」をタップすると、聞き取れなかった文をここに集められます。
            </ThemedText>
            <Pressable
              onPress={() => router.push('/(tabs)')}
              style={[styles.emptyCta, { borderColor: colors.primary }]}
              accessibilityRole="button"
            >
              <ThemedText variant="caption" color="primary" style={styles.emptyCtaText}>
                ライブラリを開く
              </ThemedText>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => {
          const lesson = lessonList.find((l) => l.entry.id === item.lessonId);
          const bundle = lesson?.bundle;
          if (!bundle) return null;

          const sentence = bundle.data.sentences.find((s) => s.index === item.sentenceIndex);
          if (!sentence) return null;

          return (
            <Pressable
              onPress={() =>
                router.push(`/lesson?lesson=${item.lessonId}&sentence=${item.sentenceIndex + 1}`)
              }
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <ThemedText variant="heading">{sentence.text}</ThemedText>
              <ThemedText variant="caption" color="muted">
                {sentence.translationJa}
              </ThemedText>
              <View style={styles.cardFooter}>
                <ThemedText variant="caption" color="primary">
                  {bundle.data.titleJa}
                </ThemedText>
                <View style={styles.footerRight}>
                  <ThemedText variant="caption" color="muted">
                    {new Date(item.addedAtMs).toLocaleDateString('ja-JP')}
                  </ThemedText>
                  <Pressable
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="苦手フレーズから外す"
                    onPress={() => toggleWeakSentence(item.lessonId, item.sentenceIndex)}
                  >
                    <ThemedText variant="caption" color="primary" style={styles.removeText}>
                      外す
                    </ThemedText>
                  </Pressable>
                </View>
              </View>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    marginTop: 4,
    marginBottom: 12,
  },
  list: {
    paddingBottom: 24,
    gap: 12,
  },
  emptyCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 8,
    marginTop: 8,
    alignItems: 'center',
  },
  emptyHint: {
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyCta: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 4,
  },
  emptyCtaText: {
    fontWeight: '700',
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  removeText: {
    fontWeight: '600',
  },
});
