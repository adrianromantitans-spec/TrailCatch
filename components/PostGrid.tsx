import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { FlatList, Pressable, useWindowDimensions } from 'react-native';
import type { SocialPost } from '../services/social';
import { t } from '../i18n';
import { Notice, side, styles, usePalette } from './ui';

export function PostGrid({ posts, bottom, loadMore, retry, error, empty = t.noPosts, refreshing, onRefresh, emptyState, loadingState }: {
  posts?: SocialPost[]; bottom: number; loadMore: () => void; retry: () => void; error?: boolean;
  empty?: string; refreshing?: boolean; onRefresh?: () => void;
  emptyState?: ReactElement; loadingState?: ReactElement;
}) {
  const router = useRouter();
  const p = usePalette();
  const { width } = useWindowDimensions();
  const tile = (width - 2 * side - 16) / 3;
  return <FlatList data={posts ?? []} keyExtractor={(item) => item.id} numColumns={3} style={styles.screen}
    contentContainerStyle={{ paddingHorizontal: side, paddingBottom: bottom, paddingTop: 8 }}
    refreshing={refreshing} onRefresh={onRefresh} keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="never"
    columnWrapperStyle={{ gap: 8, marginBottom: 8 }} windowSize={5} onEndReached={loadMore}
    ListEmptyComponent={error ? undefined : (posts ? emptyState : loadingState) ?? <Notice message={posts ? empty : t.loading} loading={!posts} />}
    ListFooterComponent={error ? <Notice message={t.loadError} retry={retry} /> : undefined}
    renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={item.caption || t.post}
      onPress={() => router.push({ pathname: '/post/[id]', params: { id: item.id } })}
      style={{ width: tile, height: tile, borderRadius: 10, overflow: 'hidden', backgroundColor: p.soft,
        alignItems: 'center', justifyContent: 'center' }}>
      {item.photos[0] ? <Image source={item.photos[0].thumbnail ?? item.photos[0].uri}
        style={{ width: '100%', height: '100%' }} recyclingKey={item.id} cachePolicy="memory" />
        : <Ionicons name={item.video ? 'play-outline' : 'document-text-outline'} size={24} color={p.accent} />}
    </Pressable>} />;
}
