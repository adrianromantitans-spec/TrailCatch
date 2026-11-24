import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, useWindowDimensions } from 'react-native';
import type { SocialPost } from '../services/social';
import { t } from '../i18n';
import { Notice, side, styles, usePalette } from './ui';

export function PostGrid({ posts, bottom, loadMore, retry, error }: {
  posts?: SocialPost[]; bottom: number; loadMore: () => void; retry: () => void; error?: boolean;
}) {
  const router = useRouter();
  const p = usePalette();
  const { width } = useWindowDimensions();
  const tile = (width - 2 * side - 16) / 3;
  return <FlatList data={posts ?? []} keyExtractor={(item) => item.id} numColumns={3} style={styles.screen}
    contentContainerStyle={{ paddingHorizontal: side, paddingBottom: bottom, paddingTop: 8 }}
    columnWrapperStyle={{ gap: 8, marginBottom: 8 }} windowSize={5} onEndReached={loadMore}
    ListEmptyComponent={error ? undefined : <Notice message={posts ? t.noPosts : t.loading} loading={!posts} />}
    ListFooterComponent={error ? <Notice message={t.loadError} retry={retry} /> : undefined}
    renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={item.caption || t.post}
      onPress={() => router.push({ pathname: '/post/[id]', params: { id: item.id } })}
      style={{ width: tile, height: tile, borderRadius: 10, overflow: 'hidden', backgroundColor: p.soft,
        alignItems: 'center', justifyContent: 'center' }}>
      {item.photos[0] ? <Image source={item.photos[0].thumbnail ?? item.photos[0].uri}
        style={{ width: '100%', height: '100%' }} recyclingKey={item.id} cachePolicy="memory" />
        : <Ionicons name="document-text-outline" size={24} color={p.accent} />}
    </Pressable>} />;
}
