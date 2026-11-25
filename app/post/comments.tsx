import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CategoryBadge } from '../../components/CategoryPicker';
import { Avatar, Button, IconButton, Notice, onBrand, side, usePalette } from '../../components/ui';
import { localDate } from '../../db/model';
import type { OutingType } from '../../db/model';
import { locale, relativeDate, t } from '../../i18n';
import { backend, useSession } from '../../services/backend';
import { commentsPage, pageSize, profilesFor, requireBackend } from '../../services/social';
import type { PostComment } from '../../services/social';

const clock = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' });

function useCommentPages(postId: string, parent: string | null) {
  const [rows, setRows] = useState<PostComment[]>();
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [more, setMore] = useState(false);
  const state = useRef<{ cursor?: PostComment; request?: AbortController; exhausted?: boolean }>({});

  const load = useCallback(async (reset: boolean) => {
    const current = state.current;
    if (!reset && (current.request || current.exhausted || !current.cursor)) return;
    current.request?.abort();
    const request = new AbortController();
    current.request = request;
    setError(false); setLoading(true);
    try {
      const entries = await commentsPage(postId, parent, reset ? undefined : current.cursor, request.signal);
      if (request.signal.aborted) return;
      current.cursor = entries.at(-1);
      current.exhausted = entries.length < pageSize;
      setMore(!current.exhausted);
      setRows((old) => reset ? entries : [...(old ?? []), ...entries.filter((entry) => !old?.some((item) => item.id === entry.id))]);
    } catch { if (!request.signal.aborted) setError(true); }
    finally {
      if (current.request === request) { current.request = undefined; setLoading(false); }
    }
  }, [postId, parent]);

  useFocusEffect(useCallback(() => {
    void load(true);
    return () => state.current.request?.abort();
  }, [load]));
  return { rows, error, loading, more, load };
}

function CommentRow({ entry, viewer, reply, toggle, expanded, openProfile, remove, report }: {
  entry: PostComment; viewer?: string; reply?: () => void; toggle?: () => void; expanded?: boolean;
  openProfile: () => void; remove: () => void; report: () => void;
}) {
  const p = usePalette();
  const author = entry.author?.display_name ?? t.unavailable;
  const date = new Date(entry.created_at);
  const when = Number.isFinite(date.getTime()) ? `${relativeDate(localDate(date))} · ${clock.format(date)}` : '';

  function options() {
    const action = viewer === entry.user_id
      ? { text: t.deleteComment, onPress: remove, style: 'destructive' as const }
      : { text: t.reportComment, onPress: report };
    Alert.alert(t.comment, undefined, [action, { text: t.cancel, style: 'cancel' }]);
  }

  return <View style={layout.comment}>
    <Pressable hitSlop={4} accessibilityRole="button" accessibilityLabel={author} onPress={openProfile}>
      {entry.author?.avatar_url ? <Image source={entry.author.avatar_url} style={layout.avatar} /> : <Avatar size={32} />}
    </Pressable>
    <View style={layout.commentBody}>
      <Text style={[layout.author, { color: p.accent }]} accessibilityRole="link" onPress={openProfile}>{author}</Text>
      <Text style={[layout.bodyText, { color: p.ink }]}>{entry.body}</Text>
      <View style={layout.commentActions}>
        {!!when && <Text style={[layout.caption, { color: p.muted }]}>{when}</Text>}
        {reply && <Pressable hitSlop={6} accessibilityRole="button" onPress={reply}>
          <Text style={[layout.action, { color: p.accent }]}>{t.reply}</Text>
        </Pressable>}
        {toggle && <Pressable hitSlop={6} accessibilityRole="button" accessibilityState={{ expanded }} onPress={toggle}>
          <Text style={[layout.action, { color: p.accent }]}>{expanded ? t.hideReplies : t.viewReplies}</Text>
        </Pressable>}
      </View>
    </View>
    <IconButton name="ellipsis-horizontal" label={t.commentOptions} onPress={options} />
  </View>;
}

function Replies({ id, root, render }: { id: string; root: string; render: (entry: PostComment) => React.ReactNode }) {
  const p = usePalette();
  const { rows, error, loading, more, load } = useCommentPages(id, root);
  return <View style={[layout.replies, { borderColor: '#A6C9B6' }]}>
    {rows?.map((entry) => <View key={entry.id}>{render(entry)}</View>)}
    {!rows && loading && <Text style={[layout.caption, { color: p.muted }]}>{t.loading}</Text>}
    {rows?.length === 0 && !error && <Text style={[layout.caption, { color: p.muted }]}>{t.noReplies}</Text>}
    {(error || more) && <Button label={error ? t.retry : t.moreReplies} disabled={loading} onPress={() => void load(error)} />}
  </View>;
}

export default function CommentsSheet() {
  const { id, parent } = useLocalSearchParams<{ id: string; parent?: string }>();
  const router = useRouter();
  const p = usePalette();
  const { bottom } = useSafeAreaInsets();
  const [post, setPost] = useState<{ category?: OutingType; parent?: PostComment } | null>();
  const [failedRevision, setFailedRevision] = useState<number>();
  const [revision, setRevision] = useState(0);
  const error = failedRevision === revision;

  useFocusEffect(useCallback(() => {
    if (!id || !backend) return;
    const request = new AbortController();
    void (async () => {
      try {
        const result = await requireBackend().from('posts').select('id,trip_preview').eq('id', id).abortSignal(request.signal).maybeSingle();
        if (result.error) throw result.error;
        if (!result.data) {
          if (!request.signal.aborted) { setPost(null); setFailedRevision(undefined); }
          return;
        }
        let root: PostComment | undefined;
        if (parent) {
          const original = await requireBackend().from('comments').select('id,user_id,body,created_at')
            .eq('post_id', id).eq('id', parent).is('parent_id', null).abortSignal(request.signal).maybeSingle();
          if (original.error) throw original.error;
          if (original.data) {
            const authors = await profilesFor([original.data.user_id]);
            root = { ...original.data, author: authors.get(original.data.user_id) };
          }
        }
        if (!request.signal.aborted) { setPost({ category: result.data.trip_preview?.type, parent: root }); setFailedRevision(undefined); }
      } catch { if (!request.signal.aborted) setFailedRevision(revision); }
    })();
    return () => request.abort();
  }, [id, parent, revision]));

  return <KeyboardAvoidingView style={[layout.sheet, { backgroundColor: p.surface }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={[layout.header, { borderColor: p.line }]}>
      <Text accessibilityRole="header" style={[layout.heading, { color: p.accent }]}>{t.comments}</Text>
      {post?.category && <CategoryBadge type={post.category} />}
      <IconButton name="close" label={t.closeComments} onPress={() => router.canGoBack() ? router.back() :
        router.replace(id ? { pathname: '/post/[id]', params: { id } } : '/')} />
    </View>
    {!backend || error || !post ? <Notice message={!backend ? t.backendUnavailable : error ? t.loadError : !id || post === null ? t.noResults : t.loading}
      loading={!!backend && !!id && !error && post === undefined}
      retry={error ? () => setRevision((value) => value + 1) : undefined} />
      : <Conversation key={id} id={id} initialParent={post.parent} bottom={bottom} />}
  </KeyboardAvoidingView>;
}

function Conversation({ id, initialParent, bottom }: { id: string; initialParent?: PostComment; bottom: number }) {
  const p = usePalette();
  const router = useRouter();
  const viewer = useSession().session?.user.id;
  const { rows, error, loading, load } = useCommentPages(id, null);
  const [open, setOpen] = useState<Record<string, number>>(initialParent ? { [initialParent.id]: 0 } : {});
  const [hiddenRoot, setHiddenRoot] = useState<string>();
  const [reply, setReply] = useState<PostComment>();
  const [draft, setDraft] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const input = useRef<React.ComponentRef<typeof TextInput>>(null);
  const pinned = initialParent?.id !== hiddenRoot ? initialParent : undefined;
  const visible = pinned ? [pinned, ...(rows ?? []).filter(({ id }) => id !== pinned.id)] : rows ?? [];

  async function send() {
    if (!viewer || !draft.trim() || sending.current) return;
    sending.current = true; setBusy(true); setMessage('');
    try {
      const { error } = await requireBackend().from('comments').insert({ post_id: id, parent_id: reply?.id ?? null, body: draft.trim() });
      if (error) { setMessage(error.code === 'P0001' ? t.commentLimit : t.saveError); return; }
      setDraft('');
      if (reply) setOpen((items) => ({ ...items, [reply.id]: (items[reply.id] ?? 0) + 1 }));
      else await load(true);
      setReply(undefined);
    } catch { setMessage(t.actionError); }
    finally { sending.current = false; setBusy(false); }
  }

  function remove(entry: PostComment, root?: string) {
    Alert.alert(t.deleteCommentPrompt, undefined, [
      { text: t.cancel, style: 'cancel' },
      { text: t.delete, style: 'destructive', onPress: async () => {
        try {
          const result = await requireBackend().rpc('delete_own_comment', { comment: entry.id });
          if (result.error) throw result.error;
          if (root) setOpen((items) => ({ ...items, [root]: (items[root] ?? 0) + 1 }));
          else {
            if (pinned?.id === entry.id) setHiddenRoot(entry.id);
            if (reply?.id === entry.id) setReply(undefined);
            await load(true);
          }
        } catch { Alert.alert(t.actionError); }
      } },
    ]);
  }

  function renderComment(entry: PostComment, root?: string) {
    function toggle() {
      setOpen((old) => {
        if (old[entry.id] === undefined) return { ...old, [entry.id]: 0 };
        const next = { ...old };
        delete next[entry.id];
        return next;
      });
    }
    return <CommentRow entry={entry} viewer={viewer} expanded={open[entry.id] !== undefined}
      openProfile={() => router.push({ pathname: '/user/[id]', params: { id: entry.user_id } })}
      remove={() => remove(entry, root)} report={() => router.push({ pathname: '/report', params: { kind: 'comment', id: entry.id } })}
      toggle={root ? undefined : toggle}
      reply={!root && viewer ? () => {
        if (sending.current) return;
        setReply(entry); setMessage(''); input.current?.focus();
      } : undefined} />;
  }

  return <>
    <FlatList data={visible} keyExtractor={(entry) => entry.id} style={layout.list}
      contentContainerStyle={layout.listContent} keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="never"
      refreshing={loading && !!rows} onRefresh={() => void load(true)} onEndReached={() => void load(false)}
      ListEmptyComponent={error ? undefined : <Notice message={rows ? t.noComments : t.loading} loading={!rows} />}
      ListFooterComponent={error ? <Notice message={t.loadError} retry={() => void load(true)} /> : undefined}
      renderItem={({ item }) => <>
        {renderComment(item)}
        {open[item.id] !== undefined && <Replies key={open[item.id]} id={id} root={item.id} render={(entry) => renderComment(entry, item.id)} />}
      </>} />
    <View style={[layout.composer, { borderColor: p.line, paddingBottom: Math.max(8, bottom) }]}>
      {reply && <View style={layout.replyTo}>
        <Text numberOfLines={1} style={[layout.target, { color: p.accent }]}>{t.replyingTo(reply.author?.display_name ?? t.unavailable)}</Text>
        <IconButton name="close" label={t.cancelReply} onPress={() => setReply(undefined)} />
      </View>}
      {!!message && <Text style={{ color: p.danger }} accessibilityLiveRegion="polite">{message}</Text>}
      {viewer ? <View style={layout.sendRow}>
        <TextInput ref={input} accessibilityLabel={t.commentPlaceholder} placeholder={t.commentPlaceholder}
          placeholderTextColor={p.muted} value={draft} onChangeText={setDraft} multiline maxLength={1000} editable={!busy}
          style={[layout.input, { color: p.ink, backgroundColor: p.field, borderColor: p.line }]} />
        <Pressable accessibilityRole="button" accessibilityLabel={t.send} accessibilityState={{ disabled: busy || !draft.trim(), busy }}
          disabled={busy || !draft.trim()} onPress={() => void send()}
          style={[layout.send, { backgroundColor: busy || !draft.trim() ? p.muted : p.accent }]}>
          <Ionicons name="arrow-up" size={22} color={onBrand} />
        </Pressable>
      </View> : <Button label={t.signIn} onPress={() => router.push('/account')} />}
    </View>
  </>;
}

const layout = StyleSheet.create({
  sheet: { flex: 1, paddingTop: 12 },
  header: { paddingHorizontal: side, alignItems: 'center', flexDirection: 'row', gap: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  heading: { flex: 1, fontSize: 20, fontWeight: '800' },
  list: { flex: 1 },
  listContent: { paddingHorizontal: side, paddingVertical: 12, gap: 16 },
  comment: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  commentBody: { flex: 1, minWidth: 0, gap: 4 },
  author: { fontWeight: '700', fontSize: 14 },
  bodyText: { fontSize: 15 },
  commentActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 12, rowGap: 6 },
  caption: { fontSize: 12 },
  action: { fontSize: 12, fontWeight: '700' },
  replies: { marginLeft: 16, marginTop: 10, paddingLeft: 8, paddingVertical: 4, borderLeftWidth: 2, gap: 12 },
  composer: { paddingHorizontal: side, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, gap: 6 },
  replyTo: { flexDirection: 'row', alignItems: 'center' },
  target: { flex: 1, fontWeight: '700' },
  sendRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: { flex: 1, minWidth: 0, minHeight: 44, maxHeight: 98, borderRadius: 22, borderWidth: 1, paddingVertical: 10,
    paddingHorizontal: 14, fontSize: 16 },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
