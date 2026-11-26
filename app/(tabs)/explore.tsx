import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import type { ComponentRef } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import type { FlatListProps } from 'react-native';
import { CategoryChips } from '../../components/CategoryPicker';
import { FeedHeader, FeedTabs } from '../../components/FeedHeader';
import { TabContent, useTabClearance } from '../../components/GlassTabBar';
import { PeopleResults } from '../../components/PeopleResults';
import { PostGrid } from '../../components/PostGrid';
import { ReelVideo } from '../../components/ReelVideo';
import { GridSkeleton } from '../../components/Skeleton';
import { PressFeedback } from '../../components/PressFeedback';
import { Button, EmptyState, IconButton, Notice, side, styles, usePalette } from '../../components/ui';
import type { OutingType } from '../../db/model';
import { t } from '../../i18n';
import { backend, useSession } from '../../services/backend';
import { selectionFeedback } from '../../services/interaction';
import { discoveryPage, pageSize, profilesFor, reelsAvailable } from '../../services/social';
import type { Profile, SocialPost } from '../../services/social';

type Mode = 'posts' | 'reels' | 'people';
const modes = ['posts', 'reels', 'people'] as const;
const labels = { posts: t.posts, reels: t.reels, people: t.users };
const reelViewability = { itemVisiblePercentThreshold: 60, minimumViewTime: 160 };

function CommunityPosts({ mode, query, category, viewer, hasReels, bottom, clearFilters }: {
  mode: Exclude<Mode, 'people'>; query: string; category?: OutingType; viewer?: string; hasReels: boolean; bottom: number;
  clearFilters: () => void;
}) {
  const router = useRouter();
  const p = usePalette();
  const filterKey = JSON.stringify([query, category]);
  const [result, setResult] = useState<{ key: string; items?: SocialPost[]; failed?: boolean }>();
  const [refreshing, setRefreshing] = useState(false);
  const [playing, setPlaying] = useState<string>();
  const page = useRef<{ request?: AbortController; cursor?: SocialPost; more: boolean }>({ more: true });
  const onViewable = useCallback<NonNullable<FlatListProps<SocialPost>['onViewableItemsChanged']>>(({ viewableItems }) => {
    setPlaying(viewableItems[0]?.item.id);
  }, []);

  const load = useCallback(async (reset: boolean, showRefresh = false) => {
    const current = page.current;
    if (!reset && (current.request || !current.more || !current.cursor)) return;
    current.request?.abort();
    const request = new AbortController();
    current.request = request;
    if (reset) setRefreshing(showRefresh);
    try {
      const items = await discoveryPage(query, mode, hasReels, viewer, reset ? undefined : current.cursor, request.signal, category);
      if (request.signal.aborted) return;
      current.cursor = items[items.length - 1];
      current.more = items.length === pageSize;
      setResult((old) => {
        const previous = !reset && old?.key === filterKey ? old.items ?? [] : [];
        return { key: filterKey, items: [...previous, ...items.filter(({ id }) => !previous.some((item) => item.id === id))] };
      });
    } catch {
      if (!request.signal.aborted) setResult((old) => ({ key: filterKey, items: old?.key === filterKey ? old.items : undefined, failed: true }));
    } finally {
      if (current.request === request) {
        current.request = undefined;
        setRefreshing(false);
      }
    }
  }, [category, filterKey, hasReels, mode, query, viewer]);

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

  const data = result?.key === filterKey ? result : undefined;
  const retry = () => void load(true);
  const refresh = () => void load(true, true);
  const more = () => void load(false);
  const empty = query || category
    ? <EmptyState icon="search-outline" message={t.exploreNoResults} action={t.clearFilters} onAction={clearFilters} />
    : mode === 'reels' ? <EmptyState icon="videocam-outline" message={t.noReels} action={t.newReel}
        onAction={() => router.push({ pathname: '/post/create', params: { media: 'reel' } })} />
      : <EmptyState icon="images-outline" message={t.exploreNoResults} action={t.newPost} onAction={() => router.push('/post/create')} />;
  if (mode === 'posts') return <PostGrid posts={data?.items} bottom={bottom} refreshing={!!data?.items && refreshing} onRefresh={refresh}
    loadMore={more} retry={retry} error={data?.failed} emptyState={empty} loadingState={<GridSkeleton inset={0} />} />;

  return <FlatList data={data?.items ?? []} keyExtractor={(item) => item.id}
    style={styles.screen} contentContainerStyle={[styles.content, { paddingBottom: bottom }]}
    contentInsetAdjustmentBehavior="never" keyboardShouldPersistTaps="handled"
    refreshing={!!data?.items && refreshing} onRefresh={refresh} onEndReached={more} windowSize={4} initialNumToRender={2}
    viewabilityConfig={reelViewability} onViewableItemsChanged={onViewable}
    ListEmptyComponent={data?.failed ? undefined : data ? empty : <GridSkeleton inset={0} />}
    ListFooterComponent={data?.failed ? <Notice message={t.loadError} retry={retry} /> : undefined}
    renderItem={({ item }) => <View style={styles.group}>
      {item.video && item.id === playing ? <ReelVideo key={item.video.uri} uri={item.video.uri} autoplay /> :
        <View style={[layout.preview, { backgroundColor: p.soft }]}>
          {item.video ? <Button label={t.playReel} icon="play-outline" onPress={() => setPlaying(item.id)} />
            : <Notice message={t.reelPlaybackError} retry={retry} />}
        </View>}
      {!!item.author && <PressFeedback style={layout.authorLink} accessibilityRole="link" onPress={() =>
        router.push({ pathname: '/user/[id]', params: { id: item.user_id } })}>
        <Text style={{ color: p.accent, fontWeight: '700' }}>{item.author.display_name}</Text>
      </PressFeedback>}
      {!!item.caption && <Text numberOfLines={3} style={{ color: p.ink }}>{item.caption}</Text>}
      <Button label={t.comments} icon="chatbubble-outline" onPress={() =>
        router.push({ pathname: '/post/comments', params: { id: item.id } })} />
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
  const [category, setCategory] = useState<OutingType | 'all'>('all');
  const [mode, setMode] = useState<Mode>('posts');
  const [hasReels, setHasReels] = useState<boolean>();
  const [profile, setProfile] = useState<Profile>();
  const clearFilters = () => { setQuery(''); setCategory('all'); };

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

  useFocusEffect(useCallback(() => {
    if (!backend || !viewer) return;
    let active = true;
    void profilesFor([viewer]).then((profiles) => {
      if (active) setProfile(profiles.get(viewer));
    }).catch(() => {});
    return () => { active = false; };
  }, [viewer]));

  return <TabContent name="explore">
    <View style={{ backgroundColor: p.surface }}>
      <FeedHeader safeTop title={t.explore} avatarUrl={profile?.id === viewer ? profile?.avatar_url : undefined}
        onProfile={() => router.navigate('/profile')}
        action={backend && <IconButton name="map-outline" label={t.spots} onPress={() => router.push('/spots')} />} />
      {backend && <>
        <View style={[layout.search, { backgroundColor: p.field }]}>
          <Ionicons name="search-outline" size={20} color={p.muted} />
          <TextInput ref={input} accessibilityLabel={t.searchCommunity} placeholder={t.searchCommunity} value={query}
            onChangeText={setQuery} maxLength={80} placeholderTextColor={p.muted} style={[layout.input, { color: p.ink }]}
            keyboardAppearance="light" autoCapitalize="none" autoCorrect={false} returnKeyType="search" />
          {!!query && <IconButton name="close-circle-outline" label={t.clearCommunitySearch} onPress={() => setQuery('')} />}
        </View>
        {mode !== 'people' && <CategoryChips value={category} onChange={setCategory} />}
        <FeedTabs items={modes} labels={labels} selected={mode} onSelect={(next) => {
          if (next === mode) return;
          selectionFeedback();
          setMode(next);
        }} />
      </>}
    </View>
    {!backend ? <Notice message={t.backendUnavailable} /> : <>
      {mode === 'people' ? <PeopleResults query={query.trim()} bottom={bottom} loadingState={<GridSkeleton inset={0} />}
          emptyState={<EmptyState icon="people-outline" message={t.exploreNoResults}
            action={query.trim() ? t.clearFilters : t.posts} onAction={query.trim() ? clearFilters : () => setMode('posts')} />} />
        : hasReels === undefined ? <GridSkeleton />
        : mode === 'reels' && !hasReels ? <EmptyState icon="videocam-outline" message={t.reelsUnavailable}
            action={t.posts} onAction={() => setMode('posts')} />
        : <>
          {mode === 'reels' && <View style={layout.create}>
            <Button label={t.newReel} icon="videocam-outline" onPress={() =>
              router.push({ pathname: '/post/create', params: { media: 'reel' } })} />
          </View>}
          <CommunityPosts key={`${mode}:${viewer ?? 'guest'}`} mode={mode} query={query.trim()}
            category={category === 'all' ? undefined : category} clearFilters={clearFilters}
            viewer={viewer} hasReels={hasReels} bottom={bottom} />
        </>}
    </>}
  </TabContent>;
}

const layout = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 22, marginHorizontal: 16, marginTop: 8, paddingLeft: 12 },
  input: { flex: 1, minWidth: 0, minHeight: 44, paddingRight: 12, fontSize: 16 },
  preview: { width: '100%', aspectRatio: 4 / 5, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  create: { paddingHorizontal: side, paddingVertical: 4 },
  authorLink: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignSelf: 'flex-start' },
});
