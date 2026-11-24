import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, FlatList, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PostGrid } from '../../components/PostGrid';
import { Avatar, Button, Header, Notice, side, styles, usePalette } from '../../components/ui';
import { t } from '../../i18n';
import { backend, useSession } from '../../services/backend';
import { changeRelation, decoratePosts, pageSize, profilesFor } from '../../services/social';
import type { PostRow, Profile, SocialPost } from '../../services/social';

type Mode = 'posts' | 'followers' | 'following';

export default function UserProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const p = usePalette();
  const inset = useSafeAreaInsets();
  const { session } = useSession();
  const viewer = session?.user.id;
  const [mode, setMode] = useState<Mode>('posts');
  const [profile, setProfile] = useState<Profile | null>();
  const [posts, setPosts] = useState<SocialPost[]>();
  const [people, setPeople] = useState<Profile[]>();
  const [numbers, setNumbers] = useState({ posts: 0, followers: 0, following: 0 });
  const [followed, setFollowed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const page = useRef({ offset: 0, busy: false, more: true, version: 0 });
  const load = useCallback(async (reset: boolean) => {
    if (!backend || !id) return;
    const client = backend;
    const state = page.current;
    if (!reset && (state.busy || !state.more || !state.offset)) return;
    const version = reset ? ++state.version : state.version;
    state.busy = true; setError(false);
    try {
      if (reset) {
        const [person, postCount, followers, following, follows] = await Promise.all([
          client.from('profiles').select('id,display_name,avatar_url,bio').eq('id', id).maybeSingle(),
          client.from('posts').select('id', { count: 'exact', head: true }).eq('user_id', id),
          client.from('follows').select('follower_id', { count: 'exact', head: true }).eq('following_id', id),
          client.from('follows').select('following_id', { count: 'exact', head: true }).eq('follower_id', id),
          viewer ? client.from('follows').select('following_id').eq('follower_id', viewer).eq('following_id', id).maybeSingle() : null,
        ]);
        if (person.error || postCount.error || followers.error || following.error || follows?.error) throw new Error('Profile load failed');
        if (state.version !== version) return;
        setProfile(person.data);
        if (!person.data) return;
        setNumbers({ posts: postCount.count ?? 0, followers: followers.count ?? 0, following: following.count ?? 0 });
        setFollowed(!!follows?.data);
      }
      const offset = reset ? 0 : state.offset;
      if (mode === 'posts') {
        const response = await client.from('posts').select().eq('user_id', id).order('created_at', { ascending: false })
          .order('id', { ascending: false }).range(offset, offset + pageSize - 1);
        if (response.error) throw response.error;
        const batch = await decoratePosts(response.data as PostRow[], viewer);
        if (state.version !== version) return;
        state.more = response.data.length === pageSize;
        state.offset = offset + response.data.length;
        setPosts((old) => reset ? batch : [...(old ?? []), ...batch.filter((item) => !old?.some(({ id }) => id === item.id))]);
      } else {
        const column = mode === 'followers' ? 'follower_id' : 'following_id';
        const opposite = mode === 'followers' ? 'following_id' : 'follower_id';
        const response = await client.from('follows').select('follower_id,following_id').eq(opposite, id)
          .order('created_at', { ascending: false }).order(column).range(offset, offset + pageSize - 1);
        if (response.error) throw response.error;
        const names = await profilesFor(response.data.map((entry) => entry[column]));
        if (state.version !== version) return;
        state.more = response.data.length === pageSize;
        state.offset = offset + response.data.length;
        setPeople((old) => reset ? [...names.values()] : [...(old ?? []), ...[...names.values()].filter((item) => !old?.some(({ id }) => id === item.id))]);
      }
    } catch { if (state.version === version) setError(true); }
    finally { if (state.version === version) state.busy = false; }
  }, [id, mode, viewer]);
  useFocusEffect(useCallback(() => { void load(true); return () => { page.current.version++; }; }, [load]));

  async function toggle() {
    if (!viewer) { router.push('/account'); return; }
    if (busy) return;
    const next = !followed;
    setBusy(true); setFollowed(next);
    setNumbers((old) => ({ ...old, followers: Math.max(0, old.followers + (next ? 1 : -1)) }));
    try { await changeRelation('follows', viewer, id, next); }
    catch { setFollowed(!next); void load(true); Alert.alert(t.actionError); }
    finally { setBusy(false); }
  }

  function block() {
    if (!backend || !viewer) { router.push('/account'); return; }
    const client = backend;
    Alert.alert(t.blockPrompt, undefined, [
      { text: t.cancel, style: 'cancel' },
      { text: t.block, style: 'destructive', onPress: async () => {
        const result = await client.from('blocks').insert({ blocker_id: viewer, blocked_id: id });
        if (result.error) Alert.alert(t.actionError); else router.back();
      } },
    ]);
  }

  return <>
    <Header title={profile?.display_name ?? t.profile} back={() => router.back()} />
    {!backend || !profile ? <Notice message={!backend ? t.backendUnavailable : error ? t.loadError : profile === null ? t.noResults : t.loading}
      loading={!!backend && profile === undefined && !error} retry={error ? () => void load(true) : undefined} /> : <>
      <View style={styles.content}>
        <View style={styles.row}>
          {profile.avatar_url ? <Image source={profile.avatar_url} style={{ width: 60, height: 60, borderRadius: 30 }} /> : <Avatar size={60} />}
          {!!profile.bio && <Text style={{ color: p.ink, flex: 1 }}>{profile.bio}</Text>}
        </View>
        {viewer !== id && <View style={styles.row}>
          <Button label={followed ? t.unfollow : t.follow} primary={!followed} disabled={busy} onPress={() => void toggle()} />
          <Button label={t.report} onPress={() => router.push({ pathname: '/report', params: { kind: 'user', id } })} />
          <Button label={t.block} danger onPress={block} />
        </View>}
        <View style={styles.columns}>
          {(['posts','followers','following'] as const).map((section) => <Button stretch key={section}
            label={`${numbers[section]} ${t[section]}`} selected={section === mode} onPress={() => setMode(section)} />)}
        </View>
      </View>
      {mode === 'posts' ? <PostGrid posts={posts} bottom={inset.bottom + side} loadMore={() => void load(false)}
        retry={() => void load(true)} error={error} /> : <FlatList data={people ?? []} keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.content, { paddingBottom: inset.bottom + side }]} onEndReached={() => void load(false)}
        ListEmptyComponent={error ? undefined : <Notice message={people ? t.noResults : t.loading} loading={!people} />}
        ListFooterComponent={error ? <Notice message={t.loadError} retry={() => void load(true)} /> : undefined}
        renderItem={({ item }) => <Button label={item.display_name} onPress={() => router.push({ pathname: '/user/[id]', params: { id: item.id } })} />} />}
    </>}
  </>;
}
