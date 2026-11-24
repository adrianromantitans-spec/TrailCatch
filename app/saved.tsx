import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PostGrid } from '../components/PostGrid';
import { Header, Notice, side } from '../components/ui';
import { t } from '../i18n';
import { backend, useSession } from '../services/backend';
import { decoratePosts, pageSize } from '../services/social';
import type { PostRow, SocialPost } from '../services/social';

export default function SavedPosts() {
  const router = useRouter();
  const inset = useSafeAreaInsets();
  const { session } = useSession();
  const viewer = session?.user.id;
  const [posts, setPosts] = useState<SocialPost[]>();
  const [error, setError] = useState(false);
  const page = useRef({ offset: 0, busy: false, more: true, version: 0 });
  const load = useCallback(async (reset: boolean) => {
    if (!backend || !viewer) return;
    const state = page.current;
    if (!reset && (state.busy || !state.more || !state.offset)) return;
    const version = reset ? ++state.version : state.version;
    state.busy = true;
    setError(false);
    try {
      const offset = reset ? 0 : state.offset;
      const result = await backend.from('saved').select('post_id,posts(*)').eq('user_id', viewer)
        .order('created_at',{ ascending: false }).order('post_id',{ ascending: false }).range(offset, offset + pageSize - 1);
      if (result.error) throw result.error;
      const batch = await decoratePosts(result.data.flatMap((row) => row.posts ? [row.posts as unknown as PostRow] : []), viewer);
      if (state.version !== version) return;
      state.offset = offset + result.data.length;
      state.more = result.data.length === pageSize;
      setPosts((old) => reset ? batch : [...(old ?? []), ...batch.filter((item) => !old?.some(({ id }) => id === item.id))]);
    } catch { if (state.version === version) setError(true); }
    finally { if (state.version === version) state.busy = false; }
  }, [viewer]);
  useFocusEffect(useCallback(() => { void load(true); return () => { page.current.version++; }; }, [load]));
  return <>
    <Header title={t.saved} back={() => router.back()} />
    {!backend || !viewer ? <Notice message={backend ? t.signInRequired : t.backendUnavailable} /> :
      <PostGrid posts={posts} bottom={inset.bottom + side} loadMore={() => void load(false)} retry={() => void load(true)} error={error} />}
  </>;
}
