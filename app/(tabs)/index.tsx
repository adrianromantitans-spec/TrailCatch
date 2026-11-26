import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import type { FlatList } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { FeedCard, FeedSkeleton } from '../../components/FeedCard';
import { HomeGlassTabBar, TabContent, useHomeTabClearance, useHomeTabScroll } from '../../components/GlassTabBar';
import { HomeHeader, homeHeaderHeight, homeModes } from '../../components/HomeHeader';
import type { HomeMode } from '../../components/HomeHeader';
import { SocialFeed } from '../../components/SocialFeed';
import { Notice, styles, usePalette } from '../../components/ui';
import { updateOuting } from '../../db/diary';
import { Outing } from '../../db/model';
import { useOutingPages } from '../../db/useDiary';
import { t } from '../../i18n';
import { backend, useSession } from '../../services/backend';
import { profilesFor } from '../../services/social';
import type { Profile, SocialPost } from '../../services/social';

export default function Feed() {
  const router = useRouter();
  const db = useSQLiteContext();
  const p = usePalette();
  const { top } = useSafeAreaInsets();
  const { session, guest } = useSession();
  const viewer = session?.user.id;
  const [unread, setUnread] = useState(false);
  const [author, setAuthor] = useState<Profile>();
  useFocusEffect(useCallback(() => {
    let active = true;
    setUnread(false);
    const client = backend;
    if (!client || !viewer) return;
    void profilesFor([viewer]).then((profiles) => { if (active) setAuthor(profiles.get(viewer)); }).catch(() => {});
    const check = () => {
      void client.from('notifications').select('id').eq('user_id', viewer).eq('read', false).limit(1)
        .then(({ data }) => { if (active) setUnread(!!data?.length); });
    };
    check();
    const channel = client.channel(`notification-badge:${viewer}`).on('postgres_changes', {
      event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${viewer}`,
    }, check).subscribe();
    return () => { active = false; void client.removeChannel(channel); };
  }, [viewer]));
  const bottom = useHomeTabClearance();
  const [mode, setMode] = useState<HomeMode>(backend && !guest ? 'following' : 'local');
  const diaryList = useRef<FlatList<Outing>>(null);
  const socialList = useRef<FlatList<SocialPost>>(null);
  const headerHeight = homeHeaderHeight(!!backend);
  const { onScroll, compact, headerOffset } = useHomeTabScroll(headerHeight);
  useFocusEffect(useCallback(() => () => { compact?.set(false); headerOffset.set(0); }, [compact, headerOffset]));
  const selectMode = useCallback((next: HomeMode) => {
    if (next === mode) return;
    compact?.set(false);
    headerOffset.set(0);
    setMode(next);
  }, [compact, headerOffset, mode]);
  const step = useCallback((direction: number) => {
    const next = homeModes[homeModes.indexOf(mode) + direction];
    if (next) selectMode(next);
  }, [mode, selectMode]);
  const swipe = useMemo(() => Gesture.Pan().enabled(!!backend).activeOffsetX([-24, 24]).failOffsetY([-16, 16])
    .onEnd(({ translationX, translationY, velocityX }) => {
      'worklet';
      if (Math.abs(translationX) > Math.abs(translationY) &&
          (Math.abs(translationX) >= 60 || (Math.abs(translationX) >= 32 && Math.abs(velocityX) > 450))) {
        scheduleOnRN(step, translationX < 0 ? 1 : -1);
      }
    }), [step]);
  const { items, error, refreshing, load, change } = useOutingPages();
  const currentAuthor = author?.id === viewer ? author : undefined;

  async function react(id: string, modify: (item: Outing) => Outing) {
    let changed: Outing | undefined;
    try {
      await updateOuting(db, id, (item) => changed = modify(item));
      if (changed) change(changed);
    } catch {
      Alert.alert(t.saveError);
    }
  }

  return <TabContent name="index">
    <View style={[styles.screen, { paddingTop: top, backgroundColor: p.surface }]}>
      <GestureDetector gesture={swipe}>
        <View collapsable={false} style={[styles.screen, { overflow: 'hidden' }]}>
          {mode !== 'local' ? <SocialFeed key={mode} mode={mode} bottom={bottom} top={headerHeight} listRef={socialList}
            onScroll={onScroll} feedSwipe={swipe} /> :
            <Animated.FlatList ref={diaryList} onScroll={onScroll} scrollEventThrottle={16} keyExtractor={(item) => item.id} data={items ?? []}
              style={styles.screen} contentInsetAdjustmentBehavior="never" progressViewOffset={headerHeight}
              contentContainerStyle={{ paddingTop: headerHeight, paddingBottom: bottom }}
              refreshing={refreshing} onRefresh={() => void load(true)} onEndReached={() => void load(false)}
              ListEmptyComponent={error ? undefined : items ? <Notice message={t.empty} /> : <FeedSkeleton />}
              ListFooterComponent={error ? <Notice message={t.loadError} retry={() => void load(true)} /> : undefined}
              renderItem={({ item }) => <FeedCard item={item} author={currentAuthor}
                onLike={() => void react(item.id, (old) => ({ ...old, liked: !old.liked, likes: old.likes + (old.liked ? -1 : 1) }))}
                onSave={() => void react(item.id, (old) => ({ ...old, saved: !old.saved }))}
                onComment={() => router.push({ pathname: '/outing/[id]', params: { id: item.id, comments: '1' } })} />} />}
          <HomeHeader mode={mode} hasTabs={!!backend} avatarUrl={currentAuthor?.avatar_url} unread={unread}
            offset={headerOffset} onProfile={() => router.navigate('/profile')}
            onNotifications={() => router.push('/notifications')} onSelect={selectMode} />
        </View>
      </GestureDetector>
      <HomeGlassTabBar onHomePress={() => (mode === 'local' ? diaryList.current : socialList.current)?.scrollToOffset({ offset: 0 })} />
    </View>
  </TabContent>;
}
