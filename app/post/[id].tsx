import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, FlatList, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Field, Header, Notice, side, styles, usePalette } from '../../components/ui';
import { relativeDate, t } from '../../i18n';
import { backend, useSession } from '../../services/backend';
import { decoratePosts, pageSize, profilesFor, requireBackend } from '../../services/social';
import type { Profile, SocialPost } from '../../services/social';

type Row = { id: string; user_id: string; body: string; created_at: string; author?: Profile };

export default function PostDetail() {
  const { id, parent } = useLocalSearchParams<{ id: string; parent?: string }>();
  const router = useRouter();
  const p = usePalette();
  const inset = useSafeAreaInsets();
  const { session } = useSession();
  const viewer = session?.user.id;
  const [post, setPost] = useState<SocialPost | null>();
  const [rows, setRows] = useState<Row[]>([]);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [message, setMessage] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const page = useRef({ running: false, generation: 0, more: true, cursor: undefined as Row | undefined });

  const load = useCallback(async (reset: boolean) => {
    if (!backend || !id) return;
    const current = page.current;
    if (!reset && (current.running || !current.more || !current.cursor)) return;
    const generation = reset ? ++current.generation : current.generation;
    current.running = true;
    setFailed(false);
    if (reset) setRefreshing(true);
    try {
      if (reset) {
        const result = await backend.from('posts').select().eq('id', id).maybeSingle();
        if (result.error) throw result.error;
        const [decorated] = await decoratePosts(result.data ? [result.data as SocialPost] : [], viewer);
        if (current.generation !== generation) return;
        setPost(decorated ?? null);
        if (!decorated) return;
      }
      let query = backend.from('comments').select('id,user_id,body,created_at').eq('post_id', id)
        .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(pageSize);
      query = parent ? query.eq('parent_id', parent) : query.is('parent_id', null);
      const cursor = reset ? undefined : current.cursor;
      if (cursor) query = query.or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`);
      const result = await query;
      if (result.error) throw result.error;
      const profiles = await profilesFor(result.data.map(({ user_id }) => user_id));
      if (current.generation !== generation) return;
      const entries = result.data.map((item) => ({ ...item, author: profiles.get(item.user_id) }));
      current.cursor = entries[entries.length - 1];
      current.more = entries.length === pageSize;
      setRows((old) => reset ? entries : [...old, ...entries.filter((item) => !old.some((row) => row.id === item.id))]);
    } catch { if (current.generation === generation) setFailed(true); }
    finally {
      if (current.generation === generation) { current.running = false; setRefreshing(false); }
    }
  }, [id, parent, viewer]);

  useFocusEffect(useCallback(() => { void load(true); return () => { page.current.generation++; }; }, [load]));

  async function send() {
    if (!viewer || !body.trim() || busy) return;
    setBusy(true); setMessage('');
    try {
      const { error } = await requireBackend().from('comments').insert({ post_id: id, parent_id: parent ?? null, body: body.trim() });
      if (error) { setMessage(error.code === 'P0001' ? t.commentLimit : t.saveError); return; }
      setBody('');
      await load(true);
    } catch { setMessage(t.actionError); }
    finally { setBusy(false); }
  }

  function remove(kind: 'post' | 'comment', target: string) {
    Alert.alert(kind === 'post' ? t.deletePostPrompt : t.deleteCommentPrompt, undefined, [
      { text: t.cancel, style: 'cancel' },
      { text: t.delete, style: 'destructive', onPress: async () => {
        const result = kind === 'post'
          ? await requireBackend().rpc('delete_own_post', { post: target })
          : await requireBackend().rpc('delete_own_comment', { comment: target });
        if (result.error) Alert.alert(t.actionError);
        else if (kind === 'post') router.back();
        else await load(true);
      } },
    ]);
  }

  const report = (kind: 'post' | 'comment', target: string) => router.push({ pathname: '/report', params: { kind, id: target } });
  return <>
    <Header title={parent ? t.replying : t.comments} back={() => router.back()} />
    {!backend ? <Notice message={t.backendUnavailable} /> : !post ? <Notice
      message={failed ? t.loadError : post === null ? t.noResults : t.loading} loading={!failed && post === undefined}
      retry={failed ? () => void load(true) : undefined} /> :
      <FlatList data={rows} keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.content, { paddingBottom: inset.bottom + side }]}
        refreshing={refreshing} onRefresh={() => void load(true)} onEndReached={() => void load(false)}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={<View style={styles.group}>
          {!parent && <>
            {post.photos[0] && <Image source={post.photos[0].uri} cachePolicy="memory"
              style={{ width: '100%', aspectRatio: 4 / 5, borderRadius: 14 }} />}
            {!!post.caption && <Text style={{ color: p.ink }}>{post.caption}</Text>}
            {post.trip_preview && <View style={styles.group}>
              <Text style={[styles.section, { color: p.ink }]}>{post.trip_preview.title}</Text>
              <Text style={{ color: p.muted }}>{t[post.trip_preview.type]}</Text>
              {post.trip_preview.distance != null && <Text style={{ color: p.ink }}>{post.trip_preview.distance} {t.units.km}</Text>}
            </View>}
            <View style={styles.row}>
              {viewer === post.user_id ? <Button label={t.deletePost} danger onPress={() => remove('post', id)} />
                : <Button label={t.reportPost} onPress={() => report('post', id)} />}
            </View>
          </>}
          {viewer ? <>
            <Field label={parent ? t.reply : t.comment} value={body} maxLength={1000} multiline onChangeText={setBody} />
            <Button label={busy ? t.loading : t.send} primary disabled={busy || !body.trim()} onPress={() => void send()} />
          </> : <Button label={t.signIn} onPress={() => router.push('/account')} />}
          {!!message && <Text style={{ color: p.danger }} accessibilityLiveRegion="polite">{message}</Text>}
        </View>}
        ListEmptyComponent={<Notice message={refreshing ? t.loading : t.noComments} loading={refreshing} />}
        ListFooterComponent={failed ? <Notice message={t.loadError} retry={() => void load(true)} /> : undefined}
        renderItem={({ item }) => <View style={[styles.group, { borderColor: p.line, borderTopWidth: 1, paddingTop: 12 }]}>
          <Text style={{ color: p.ink, fontWeight: '700' }}
            onPress={() => router.push({ pathname: '/user/[id]', params: { id: item.user_id } })}>
            {item.author?.display_name ?? t.unavailable}
          </Text>
          <Text style={{ color: p.ink }}>{item.body}</Text>
          <Text style={{ color: p.muted }}>{relativeDate(item.created_at.slice(0, 10))}</Text>
          <View style={styles.row}>
            {!parent && <Button label={t.viewReplies}
              onPress={() => router.push({ pathname: '/post/[id]', params: { id, parent: item.id } })} />}
            {viewer === item.user_id ? <Button label={t.deleteComment} danger onPress={() => remove('comment', item.id)} />
              : <Button label={t.reportComment} onPress={() => report('comment', item.id)} />}
          </View>
        </View>}
      />}
  </>;
}
