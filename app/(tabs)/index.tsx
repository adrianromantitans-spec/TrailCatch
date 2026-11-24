import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Alert, FlatList } from 'react-native';
import { FeedCard, FeedSkeleton } from '../../components/FeedCard';
import { TabContent, useTabClearance } from '../../components/GlassTabBar';
import { Header, IconButton, Notice } from '../../components/ui';
import { updateOuting } from '../../db/diary';
import { Outing } from '../../db/model';
import { useOutingPages } from '../../db/useDiary';
import { t } from '../../i18n';

export default function Feed() {
  const router = useRouter();
  const db = useSQLiteContext();
  const tabClearance = useTabClearance();
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
      <IconButton name="notifications-outline" align="end" label={t.notifications} onPress={() => router.push('/notifications')} />
    </Header>
    {!items && !error ? <FeedSkeleton /> :
      <FlatList keyExtractor={(item) => item.id} data={items ?? []}
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
