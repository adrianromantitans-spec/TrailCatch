import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import type { FlatListProps } from 'react-native';
import type { Gesture } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import type { Point } from '../db/model';
import { t } from '../i18n';
import { useSession } from '../services/backend';
import { changeRelation, feedPage, pageSize } from '../services/social';
import type { FeedMode, SocialPost } from '../services/social';
import { FeedSkeleton } from './FeedCard';
import { SocialPostCard } from './SocialPostCard';
import { Button, Notice, styles } from './ui';

export function SocialFeed({ mode, bottom, top, nativeBar, onScroll, feedSwipe }: {
  mode: FeedMode; bottom: number; top: number; nativeBar: boolean; onScroll?: FlatListProps<SocialPost>['onScroll'];
  feedSwipe?: ReturnType<typeof Gesture.Pan>;
}) {
  const router = useRouter();
  const { session } = useSession();
  const viewer = session?.user.id;
  const [point, setPoint] = useState<Point>();
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [posts, setPosts] = useState<SocialPost[]>();
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);
  const state = useRef({ generation: 0, busy: false, more: true, pages: 0, cursor: undefined as SocialPost | undefined });
  const mutations = useRef(new Set<string>());
  const mutationVersion = useRef(0);

  const load = useCallback(async (reason: 'focus' | 'refresh' | 'more') => {
    if ((mode === 'nearby' && !point) || (mode === 'following' && !viewer)) return;
    const current = state.current;
    const reset = reason !== 'more';
    if (!reset && (current.busy || !current.more || !current.cursor)) return;
    if (reason === 'focus' && current.pages && mutations.current.size) return;
    const generation = reset ? ++current.generation : current.generation;
    const seenMutationVersion = mutationVersion.current;
    const targetPages = reason === 'focus' ? Math.max(1, current.pages) : 1;
    current.busy = true;
    if (reset) setRefreshing(reason === 'refresh');
    if (reason !== 'focus') setFailed(false);
    try {
      // On return, refresh the loaded window without shrinking the list under its scroll position.
      const results: SocialPost[] = [];
      let cursor = reset ? undefined : current.cursor;
      let more = true;
      let pages = 0;
      while (pages < targetPages && more) {
        const page = await feedPage(mode, cursor, point, viewer);
        if (generation !== current.generation || (reason === 'focus' && seenMutationVersion !== mutationVersion.current)) return;
        results.push(...page);
        cursor = page.at(-1);
        more = page.length === pageSize;
        pages++;
      }
      current.more = more;
      current.cursor = cursor;
      current.pages = reset ? pages : current.pages + pages;
      setPosts((previous) => reset ? results : [...(previous ?? []), ...results.filter((item) => !previous?.some(({ id }) => id === item.id))]);
      setFailed(false);
    } catch { if (generation === current.generation && (reason !== 'focus' || !current.pages)) setFailed(true); }
    finally {
      if (generation === current.generation) {
        current.busy = false;
        setRefreshing(false);
      }
    }
  }, [mode, point, viewer]);

  useFocusEffect(useCallback(() => {
    void load('focus');
    return () => { state.current.generation++; state.current.busy = false; };
  }, [load]));

  async function locate() {
    if (locating) return;
    setLocating(true); setLocationError('');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) { setLocationError(t.locationDenied); return; }
      const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setPoint({ latitude: coords.latitude, longitude: coords.longitude });
    } catch { setLocationError(t.locationError); }
    finally { setLocating(false); }
  }

  async function mutate(kind: 'likes' | 'saved' | 'follows', post: SocialPost, enabled: boolean) {
    if (!viewer) { router.push('/account'); return; }
    const target = kind === 'follows' ? post.user_id : post.id;
    const lock = `${kind}:${target}`;
    if (mutations.current.has(lock)) return;
    mutations.current.add(lock);
    mutationVersion.current++;
    const applies = (item: SocialPost) => (kind === 'follows' ? item.user_id : item.id) === target;
    const change = (item: SocialPost, value: boolean) => kind === 'likes'
      ? { ...item, liked: value, likes_count: Math.max(0, item.likes_count + Number(value) - Number(item.liked)) }
      : kind === 'saved' ? { ...item, saved: value } : { ...item, followed: value };
    setPosts((old) => old?.map((item) => applies(item) ? change(item, enabled) : item));
    try { await changeRelation(kind, viewer, target, enabled); }
    catch {
      setPosts((old) => old?.map((item) => applies(item) ? change(item, !enabled) : item));
      Alert.alert(t.actionError);
    } finally { mutations.current.delete(lock); }
  }

  const needsSignIn = mode === 'following' && !viewer;
  const needsLocation = mode === 'nearby' && !point;
  const empty = needsSignIn ? <View style={styles.content}>
    <Notice message={t.signInRequired} /><Button label={t.signIn} onPress={() => router.push('/account')} />
  </View> : needsLocation ? <View style={styles.content}>
    {locationError ? <Notice message={locationError} /> : null}
    <Button label={locating ? t.loading : t.myLocation} disabled={locating} onPress={() => void locate()} icon="locate-outline" />
  </View> : failed ? undefined : posts ? <Notice message={t.noPosts} /> : <FeedSkeleton />;

  // Keep the vertical scroll view mounted while loading so the native tab bar can track it.
  return <Animated.FlatList onScroll={onScroll}
    scrollEventThrottle={16} style={styles.screen} data={posts ?? []} keyExtractor={(item) => item.id}
    windowSize={5} initialNumToRender={3} maxToRenderPerBatch={5}
    contentInsetAdjustmentBehavior={nativeBar ? 'automatic' : 'never'} progressViewOffset={top}
    contentContainerStyle={{ paddingTop: top, paddingBottom: bottom }}
    maintainVisibleContentPosition={{ minIndexForVisible: 0, autoscrollToTopThreshold: 0 }}
    refreshing={refreshing} onRefresh={needsSignIn || needsLocation ? undefined : () => void load('refresh')} onEndReached={() => void load('more')}
    ListEmptyComponent={empty}
    ListFooterComponent={failed ? <Notice message={t.loadError} retry={() => void load(posts?.length ? 'more' : 'refresh')} /> : undefined}
    renderItem={({ item }) => <SocialPostCard post={item} viewer={viewer} feedSwipe={feedSwipe}
      onLike={(value) => void mutate('likes', item, value)}
      onSave={() => void mutate('saved', item, !item.saved)}
      onFollow={() => void mutate('follows', item, !item.followed)} />} />;
}
