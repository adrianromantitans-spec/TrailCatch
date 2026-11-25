import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { FeedCard, FeedSkeleton } from '../../components/FeedCard';
import { TabContent, useHomeTabScroll, useTabClearance } from '../../components/GlassTabBar';
import { SocialFeed } from '../../components/SocialFeed';
import { Button, Header, IconButton, Notice, side, styles, usePalette } from '../../components/ui';
import { updateOuting } from '../../db/diary';
import { Outing } from '../../db/model';
import { useOutingPages } from '../../db/useDiary';
import { t } from '../../i18n';
import { backend, useSession } from '../../services/backend';

export default function Feed() {
  const router = useRouter();
  const db = useSQLiteContext();
  const p = usePalette();
  const { session, guest } = useSession();
  const viewer = session?.user.id;
  const [unread, setUnread] = useState(false);
  useFocusEffect(useCallback(() => {
    let active = true;
    setUnread(false);
    const client = backend;
    if (!client || !viewer) return;
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
  const tabClearance = useTabClearance();
  const [mode, setMode] = useState<'local' | 'following' | 'nearby'>(backend && !guest ? 'following' : 'local');
  const { onScroll, compact } = useHomeTabScroll();
  useFocusEffect(useCallback(() => () => compact?.set(false), [compact]));
  const selectMode = (next: typeof mode) => {
    if (next === mode) return;
    compact?.set(false);
    setMode(next);
  };
  const { items, error, refreshing, load, change } = useOutingPages();

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
    <Header title={t.app}>
      {backend && <IconButton name="search-outline" label={t.searchUsers}
        onPress={() => router.navigate({ pathname: '/explore', params: { people: '1' } })} />}
      <View>
        <IconButton name="notifications-outline" align="end" label={t.notifications} onPress={() => router.push('/notifications')} />
        {unread && <View pointerEvents="none" style={{ position: 'absolute', right: 0, top: 9,
          width: 8, height: 8, borderRadius: 4, backgroundColor: p.danger }} />}
      </View>
    </Header>
    {backend && <View style={[styles.columns, { paddingHorizontal: side, paddingVertical: 8 }]}>
      <Button stretch label={t.followingFeed} selected={mode === 'following'} onPress={() => selectMode('following')} />
      <Button stretch label={t.nearbyFeed} selected={mode === 'nearby'} onPress={() => selectMode('nearby')} />
      <Button stretch label={t.diary} selected={mode === 'local'} onPress={() => selectMode('local')} />
    </View>}
    {mode !== 'local' ? <SocialFeed key={mode} mode={mode} bottom={tabClearance} onScroll={onScroll} /> : !items && !error ? <FeedSkeleton /> :
      <Animated.FlatList onScroll={onScroll} scrollEventThrottle={16} keyExtractor={(item) => item.id} data={items ?? []}
        style={{ flex: 1 }} contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{ paddingBottom: tabClearance }}
        refreshing={refreshing} onRefresh={() => void load(true)} onEndReached={() => void load(false)}
        ListEmptyComponent={error ? undefined : <Notice message={t.empty} />}
        ListFooterComponent={error ? <Notice message={t.loadError} retry={() => void load(true)} /> : undefined}
        renderItem={({ item }) => <FeedCard item={item}
          onLike={() => void react(item.id, (old) => ({ ...old, liked: !old.liked, likes: old.likes + (old.liked ? -1 : 1) }))}
          onSave={() => void react(item.id, (old) => ({ ...old, saved: !old.saved }))}
          onComment={() => router.push({ pathname: '/outing/[id]', params: { id: item.id, comments: '1' } })} />} />}
  </TabContent>;
}
