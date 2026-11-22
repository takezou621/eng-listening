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
        全 {weakSentences.length} 件 (タップで該当レッスンの文へ遷移します)
      </ThemedText>

      <FlatList
        data={weakSentences}
        keyExtractor={(item) => `${item.lessonId}-${item.sentenceIndex}`}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View>
            <ThemedText style={styles.empty}>登録された苦手フレーズはありません</ThemedText>
            <ThemedText variant="caption" color="muted" style={styles.emptyHint}>
              レッスンの各文にある「☆ 苦手」をタップすると、聞き取れなかった文をここに集められます。
            </ThemedText>
          </View>
        }
        renderItem={({ item }) => {
          const lesson = lessonList.find((l) => l.entry.id === item.lessonId);
          const bundle = lesson?.bundle;
          if (!bundle) return null; // レッスン未生成の場合は表示しない

          const sentence = bundle.data.sentences.find((s) => s.index === item.sentenceIndex);
          if (!sentence) return null;

          return (
            <Pressable
              onPress={() => router.push(`/lesson?lesson=${item.lessonId}&sentence=${item.sentenceIndex + 1}`)}
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
                    <ThemedText variant="caption" color="primary" style={{ fontWeight: '600' }}>
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
  subtitle: { marginTop: 4, marginBottom: 12 },
  list: { paddingBottom: 24, gap: 10 },
  empty: { marginTop: 24, textAlign: 'center' },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  footerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  emptyHint: { marginTop: 8, textAlign: 'center', lineHeight: 18 },
});
