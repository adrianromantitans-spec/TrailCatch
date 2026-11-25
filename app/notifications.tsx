import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Header, Notice, side, styles, usePalette } from '../components/ui';
import { relativeDate, t } from '../i18n';
import { backend, useSession } from '../services/backend';
import { enablePush } from '../services/push';
import { pageSize, profilesFor, requireBackend } from '../services/social';

type Notification = {
  id: string; type: 'like' | 'comment' | 'follower'; actor_id: string; post_id: string | null;
  read: boolean; created_at: string; actor?: string;
};
const labels = { like: t.notificationLike, comment: t.notificationComment, follower: t.notificationFollow };

export default function Notifications() {
  const router = useRouter();
  const p = usePalette();
  const inset = useSafeAreaInsets();
  const { session } = useSession();
  const viewer = session?.user.id;
  const [rows, setRows] = useState<Notification[]>();
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState('');
  const [pushBusy, setPushBusy] = useState(false);
  const page = useRef({ generation: 0, busy: false, more: true, cursor: undefined as Notification | undefined });
  const load = useCallback(async (reset: boolean) => {
    if (!backend || !viewer) return;
    const current = page.current;
    if (!reset && (current.busy || !current.more || !current.cursor)) return;
    const generation = reset ? ++current.generation : current.generation;
    current.busy = true; setFailed(false);
    if (reset) setRefreshing(true);
    try {
      let query = backend.from('notifications').select('id,type,actor_id,post_id,read,created_at').eq('user_id', viewer)
        .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(pageSize);
      const cursor = reset ? undefined : current.cursor;
      if (cursor) query = query.or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`);
      const res = await query;
      if (res.error) throw res.error;
      const actors = await profilesFor(res.data.map(({ actor_id }) => actor_id));
      if (generation !== current.generation) return;
      const entries = (res.data as Notification[]).map((item) => ({ ...item, actor: actors.get(item.actor_id)?.display_name }));
      current.more = entries.length === pageSize;
      current.cursor = entries[entries.length - 1];
      setRows((old) => reset ? entries : [...(old ?? []), ...entries.filter((item) => !old?.some(({ id }) => id === item.id))]);
    } catch { if (generation === current.generation) setFailed(true); }
    finally {
      if (generation === current.generation) { current.busy = false; setRefreshing(false); }
    }
  }, [viewer]);
  useFocusEffect(useCallback(() => { void load(true); return () => { page.current.generation++; }; }, [load]));

  async function mark(id?: string) {
    let query = requireBackend().from('notifications').update({ read: true }).eq('user_id', viewer!);
    if (id) query = query.eq('id', id); else query = query.eq('read', false);
    const result = await query;
    if (result.error) { setNotice(t.actionError); return; }
    setRows((old) => old?.map((row) => !id || row.id === id ? { ...row, read: true } : row));
  }

  async function register() {
    setPushBusy(true); setNotice('');
    try {
      const state = await enablePush();
      setNotice(state === 'enabled' ? t.pushEnabled : state === 'denied' ? t.pushDenied : t.pushUnavailable);
    } catch { setNotice(t.actionError); }
    finally { setPushBusy(false); }
  }

  return <>
    <Header title={t.notifications} back={() => router.back()} />
    {!backend ? <Notice message={t.noNotifications} /> : !viewer ? <View style={styles.content}>
      <Notice message={t.signInRequired} /><Button label={t.signIn} onPress={() => router.push('/account')} />
    </View> : <FlatList data={rows ?? []} keyExtractor={(item) => item.id}
      contentContainerStyle={[styles.content, { paddingBottom: inset.bottom + side }]}
      refreshing={refreshing} onRefresh={() => void load(true)} onEndReached={() => void load(false)}
      ListHeaderComponent={<View style={styles.group}>
        <Button label={t.enablePush} disabled={pushBusy} onPress={() => void register()} />
        <Button label={t.markAllRead} onPress={() => void mark()} />
        {!!notice && <Text style={{ color: p.muted }} accessibilityLiveRegion="polite">{notice}</Text>}
      </View>}
      ListEmptyComponent={failed ? undefined : <Notice message={rows ? t.noNotifications : t.loading} loading={!rows} />}
      ListFooterComponent={failed ? <Notice message={t.loadError} retry={() => void load(true)} /> : undefined}
      renderItem={({ item }) => <View style={[styles.group, {
        backgroundColor: item.read ? p.surface : p.soft, borderRadius: 14, padding: 12,
      }]}>
        <Text style={{ color: p.ink, fontWeight: '700' }}>{item.actor ?? t.unavailable}</Text>
        <Text style={{ color: p.ink }}>{labels[item.type]}</Text>
        <Text style={{ color: p.muted }}>{relativeDate(item.created_at.slice(0, 10))}</Text>
        <View style={styles.row}>
          <Button label={item.post_id ? item.type === 'comment' ? t.comments : t.post : t.openProfile} onPress={() => {
            if (!item.read) void mark(item.id);
            if (item.post_id) router.push({ pathname: item.type === 'comment' ? '/post/comments' : '/post/[id]', params: { id: item.post_id } });
            else router.push({ pathname: '/user/[id]', params: { id: item.actor_id } });
          }} />
          {!item.read && <Button label={t.markRead} onPress={() => void mark(item.id)} />}
        </View>
      </View>} />}
  </>;
}
