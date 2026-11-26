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

export function SocialFeed({ mode, bottom, top, onScroll, feedSwipe }: {
  mode: FeedMode; bottom: number; top: number; onScroll?: FlatListProps<SocialPost>['onScroll'];
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
  const state = useRef({ generation: 0, busy: false, more: true, cursor: undefined as SocialPost | undefined });
  const mutations = useRef(new Set<string>());

  const load = useCallback(async (reset: boolean) => {
    if ((mode === 'nearby' && !point) || (mode === 'following' && !viewer)) return;
    const current = state.current;
    if (!reset && (current.busy || !current.more || !current.cursor)) return;
    const generation = reset ? ++current.generation : current.generation;
    current.busy = true;
    if (reset) setRefreshing(true);
    setFailed(false);
    try {
      const results = await feedPage(mode, reset ? undefined : current.cursor, point, viewer);
      if (generation !== current.generation) return;
      current.more = results.length === pageSize;
      current.cursor = results[results.length - 1];
      setPosts((previous) => reset ? results : [...(previous ?? []), ...results.filter((item) => !previous?.some(({ id }) => id === item.id))]);
    } catch { if (generation === current.generation) setFailed(true); }
    finally {
      if (generation === current.generation) {
        current.busy = false;
        setRefreshing(false);
      }
    }
  }, [mode, point, viewer]);

  useFocusEffect(useCallback(() => {
    void load(true);
    return () => { state.current.generation++; };
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

  if (mode === 'following' && !viewer) return <View style={[styles.content, { marginTop: top }]}>
    <Notice message={t.signInRequired} /><Button label={t.signIn} onPress={() => router.push('/account')} />
  </View>;
  if (mode === 'nearby' && !point) return <View style={[styles.content, { marginTop: top }]}>
    {locationError ? <Notice message={locationError} /> : null}
    <Button label={locating ? t.loading : t.myLocation} disabled={locating} onPress={() => void locate()} icon="locate-outline" />
  </View>;

  return !posts && !failed ? <View style={{ paddingTop: top }}><FeedSkeleton /></View> : <Animated.FlatList onScroll={onScroll}
    scrollEventThrottle={16} style={styles.screen} data={posts ?? []} keyExtractor={(item) => item.id}
    windowSize={5} initialNumToRender={3} maxToRenderPerBatch={5}
    contentInsetAdjustmentBehavior="never" progressViewOffset={top}
    contentContainerStyle={{ paddingTop: top, paddingBottom: bottom }}
    refreshing={refreshing} onRefresh={() => void load(true)} onEndReached={() => void load(false)}
    ListEmptyComponent={failed ? undefined : <Notice message={t.noPosts} />}
    ListFooterComponent={failed ? <Notice message={t.loadError} retry={() => void load(!posts?.length)} /> : undefined}
    renderItem={({ item }) => <SocialPostCard post={item} viewer={viewer} feedSwipe={feedSwipe}
      onLike={(value) => void mutate('likes', item, value)}
      onSave={() => void mutate('saved', item, !item.saved)}
      onFollow={() => void mutate('follows', item, !item.followed)} />} />;
}
