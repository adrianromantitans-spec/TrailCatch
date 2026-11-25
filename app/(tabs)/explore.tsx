import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import type { ComponentRef } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import type { FlatListProps } from 'react-native';
import { TabContent, useTabClearance } from '../../components/GlassTabBar';
import { PeopleResults } from '../../components/PeopleResults';
import { PostGrid } from '../../components/PostGrid';
import { ReelVideo } from '../../components/ReelVideo';
import { Button, Header, IconButton, Notice, side, styles, usePalette } from '../../components/ui';
import { t } from '../../i18n';
import { backend, useSession } from '../../services/backend';
import { discoveryPage, pageSize, reelsAvailable } from '../../services/social';
import type { SocialPost } from '../../services/social';

type Mode = 'posts' | 'reels' | 'people';
const modes = ['posts', 'reels', 'people'] as const;
const reelViewability = { itemVisiblePercentThreshold: 60, minimumViewTime: 160 };

function CommunityPosts({ mode, query, viewer, hasReels, bottom }: {
  mode: Exclude<Mode, 'people'>; query: string; viewer?: string; hasReels: boolean; bottom: number;
}) {
  const router = useRouter();
  const p = usePalette();
  const [result, setResult] = useState<{ query: string; items?: SocialPost[]; failed?: boolean }>();
  const [refreshing, setRefreshing] = useState(false);
  const [playing, setPlaying] = useState<string>();
  const page = useRef<{ request?: AbortController; cursor?: SocialPost; more: boolean }>({ more: true });
  const onViewable = useCallback<NonNullable<FlatListProps<SocialPost>['onViewableItemsChanged']>>(({ viewableItems }) => {
    setPlaying(viewableItems[0]?.item.id);
  }, []);

  const load = useCallback(async (reset: boolean) => {
    const current = page.current;
    if (!reset && (current.request || !current.more || !current.cursor)) return;
    current.request?.abort();
    const request = new AbortController();
    current.request = request;
    if (reset) setRefreshing(true);
    try {
      const items = await discoveryPage(query, mode, hasReels, viewer, reset ? undefined : current.cursor, request.signal);
      if (request.signal.aborted) return;
      current.cursor = items[items.length - 1];
      current.more = items.length === pageSize;
      setResult((old) => {
        const previous = !reset && old?.query === query ? old.items ?? [] : [];
        return { query, items: [...previous, ...items.filter(({ id }) => !previous.some((item) => item.id === id))] };
      });
    } catch {
      if (!request.signal.aborted) setResult((old) => ({ query, items: old?.query === query ? old.items : undefined, failed: true }));
    } finally {
      if (current.request === request) {
        current.request = undefined;
        setRefreshing(false);
      }
    }
  }, [hasReels, mode, query, viewer]);

  useFocusEffect(useCallback(() => {
    const current = page.current;
    const timer = setTimeout(() => { void load(true); }, query ? 220 : 0);
    return () => {
      clearTimeout(timer);
      current.request?.abort();
      current.request = undefined;
      current.cursor = undefined;
      current.more = true;
    };
  }, [load, query]));

  const data = result?.query === query ? result : undefined;
  const retry = () => void load(true);
  const more = () => void load(false);
  if (mode === 'posts') return <PostGrid posts={data?.items} bottom={bottom} refreshing={refreshing} onRefresh={retry}
    loadMore={more} retry={retry} error={data?.failed} empty={query ? t.noResults : t.noPosts} />;

  return <FlatList data={data?.items ?? []} keyExtractor={(item) => item.id}
    style={styles.screen} contentContainerStyle={[styles.content, { paddingBottom: bottom }]}
    contentInsetAdjustmentBehavior="never" keyboardShouldPersistTaps="handled"
    refreshing={refreshing} onRefresh={retry} onEndReached={more} windowSize={4} initialNumToRender={2}
    viewabilityConfig={reelViewability} onViewableItemsChanged={onViewable}
    ListEmptyComponent={data?.failed ? undefined : <Notice message={data ? query ? t.noResults : t.noReels : t.loading} loading={!data} />}
    ListFooterComponent={data?.failed ? <Notice message={t.loadError} retry={retry} /> : undefined}
    renderItem={({ item }) => <View style={styles.group}>
      {item.video && item.id === playing ? <ReelVideo key={item.video.uri} uri={item.video.uri} autoplay /> :
        <View style={[layout.preview, { backgroundColor: p.soft }]}>
          {item.video ? <Button label={t.playReel} icon="play-outline" onPress={() => setPlaying(item.id)} />
            : <Notice message={t.reelPlaybackError} retry={retry} />}
        </View>}
      {!!item.author && <Text style={{ color: p.accent, fontWeight: '700' }} accessibilityRole="link" onPress={() =>
        router.push({ pathname: '/user/[id]', params: { id: item.user_id } })}>{item.author.display_name}</Text>}
      {!!item.caption && <Text numberOfLines={3} style={{ color: p.ink }}>{item.caption}</Text>}
      <Button label={t.comments} icon="chatbubble-outline" onPress={() =>
        router.push({ pathname: '/post/[id]', params: { id: item.id } })} />
    </View>} />;
}

export default function Explore() {
  const p = usePalette();
  const router = useRouter();
  const { people } = useLocalSearchParams<{ people?: string }>();
  const { session } = useSession();
  const viewer = session?.user.id;
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const bottom = useTabClearance();
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<Mode>('posts');
  const [hasReels, setHasReels] = useState<boolean>();

  useFocusEffect(useCallback(() => {
    if (people !== '1') return;
    setMode('people');
    input.current?.focus();
    router.setParams({ people: undefined });
  }, [people, router]));

  useFocusEffect(useCallback(() => {
    if (!backend) return;
    const request = new AbortController();
    void reelsAvailable(request.signal).then((available) => {
      if (!request.signal.aborted) setHasReels(available);
    }).catch(() => { if (!request.signal.aborted) setHasReels(false); });
    return () => request.abort();
  }, []));

  return <TabContent name="explore">
    <Header title={t.explore}>
      {backend && <IconButton name="map-outline" label={t.spots} onPress={() => router.push('/spots')} />}
    </Header>
    {!backend ? <Notice message={t.backendUnavailable} /> : <>
      <View style={layout.controls}>
        <View style={[layout.search, { backgroundColor: p.field, borderColor: p.line }]}>
          <Ionicons name="search-outline" size={20} color={p.muted} />
          <TextInput ref={input} accessibilityLabel={t.searchCommunity} placeholder={t.searchCommunity} value={query}
            onChangeText={setQuery} maxLength={80} placeholderTextColor={p.muted} style={[layout.input, { color: p.ink }]}
            keyboardAppearance="light" autoCapitalize="none" autoCorrect={false} returnKeyType="search" />
          {!!query && <IconButton name="close-circle-outline" label={t.clearCommunitySearch} onPress={() => setQuery('')} />}
        </View>
        <View style={styles.columns}>
          {modes.map((item) => <Button key={item} stretch singleLine label={item === 'people' ? t.users : t[item]}
            selected={mode === item} onPress={() => setMode(item)} />)}
        </View>
      </View>
      {mode === 'people' ? <PeopleResults query={query.trim()} bottom={bottom} />
        : hasReels === undefined ? <Notice message={t.loading} loading />
        : mode === 'reels' && !hasReels ? <Notice message={t.reelsUnavailable} />
        : <>
          {mode === 'reels' && <View style={layout.create}>
            <Button label={t.newReel} icon="videocam-outline" onPress={() =>
              router.push({ pathname: '/post/create', params: { media: 'reel' } })} />
          </View>}
          <CommunityPosts key={`${mode}:${viewer ?? 'guest'}`} mode={mode} query={query.trim()}
            viewer={viewer} hasReels={hasReels} bottom={bottom} />
        </>}
    </>}
  </TabContent>;
}

const layout = StyleSheet.create({
  controls: { padding: side, paddingVertical: 8, gap: 8 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 16, paddingLeft: 12 },
  input: { flex: 1, minWidth: 0, minHeight: 44, paddingRight: 8, fontSize: 16 },
  preview: { width: '100%', aspectRatio: 4 / 5, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  create: { paddingHorizontal: side, paddingVertical: 4 },
});
