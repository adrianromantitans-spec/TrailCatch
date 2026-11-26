import { Image } from 'expo-image';
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CategoryBadge } from '../../components/CategoryPicker';
import { CatchBadges } from '../../components/CatchBadge';
import { ReelVideo } from '../../components/ReelVideo';
import { Button, Header, Notice, side, styles, usePalette } from '../../components/ui';
import { t } from '../../i18n';
import { backend, useSession } from '../../services/backend';
import { decoratePosts, requireBackend } from '../../services/social';
import type { PostRow, SocialPost } from '../../services/social';

export default function PostDetail() {
  const { id, parent } = useLocalSearchParams<{ id: string; parent?: string }>();
  const router = useRouter();
  const p = usePalette();
  const inset = useSafeAreaInsets();
  const viewer = useSession().session?.user.id;
  const [post, setPost] = useState<SocialPost | null>();
  const [failedRevision, setFailedRevision] = useState<number>();
  const [revision, setRevision] = useState(0);
  const failed = failedRevision === revision;

  useFocusEffect(useCallback(() => {
    if (!id || parent || !backend) return;
    const request = new AbortController();
    void (async () => {
      try {
        const result = await requireBackend().from('posts').select().eq('id', id).abortSignal(request.signal).maybeSingle();
        if (result.error) throw result.error;
        const [decorated] = await decoratePosts(result.data ? [result.data as PostRow] : [], viewer);
        if (!request.signal.aborted) { setPost(decorated ?? null); setFailedRevision(undefined); }
      } catch { if (!request.signal.aborted) setFailedRevision(revision); }
    })();
    return () => request.abort();
  }, [id, parent, viewer, revision]));

  function remove() {
    Alert.alert(t.deletePostPrompt, undefined, [
      { text: t.cancel, style: 'cancel' },
      { text: t.delete, style: 'destructive', onPress: async () => {
        try {
          const result = await requireBackend().rpc('delete_own_post', { post: id });
          if (result.error) throw result.error;
          if (router.canGoBack()) router.back(); else router.replace('/');
        } catch { Alert.alert(t.actionError); }
      } },
    ]);
  }

  if (parent) return <Redirect href={{ pathname: '/post/comments', params: { id, parent } }} />;

  return <>
    <Header title={t.post} back={() => router.canGoBack() ? router.back() : router.replace('/')} />
    {!backend || !post ? <Notice
      message={!backend ? t.backendUnavailable : failed ? t.loadError : post === null ? t.noResults : t.loading}
      loading={!!backend && !failed && post === undefined}
      retry={failed ? () => setRevision((value) => value + 1) : undefined} /> :
      <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingBottom: inset.bottom + side }]}>
        {post.video && <ReelVideo key={post.video.uri} uri={post.video.uri} />}
        {post.photos[0] && <Image source={post.photos[0].uri} cachePolicy="memory"
          style={{ width: '100%', aspectRatio: 4 / 5, borderRadius: 14 }} />}
        {!!post.caption && <Text style={{ color: p.ink }}>{post.caption}</Text>}
        {post.trip_preview && <View style={styles.group}>
          <Text style={[styles.section, { color: p.ink }]}>{post.trip_preview.title}</Text>
          <CategoryBadge type={post.trip_preview.type} />
          {post.trip_preview.distance != null && <Text style={{ color: p.ink }}>{post.trip_preview.distance} {t.units.km}</Text>}
          <CatchBadges catches={post.trip_preview.catches} />
        </View>}
        <Button label={post.comments_count ? t.openCommentCount(post.comments_count) : t.commentPlaceholder}
          icon="chatbubble-outline" onPress={() => router.push({ pathname: '/post/comments', params: { id } })} />
        <View style={styles.row}>
          {viewer === post.user_id ? <Button label={t.deletePost} danger onPress={remove} /> :
            <Button label={t.reportPost} onPress={() => router.push({ pathname: '/report', params: { kind: 'post', id } })} />}
        </View>
      </ScrollView>}
  </>;
}
