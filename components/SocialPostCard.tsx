import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { relativeDate, t } from '../i18n';
import type { SocialPost } from '../services/social';
import { FeedActions } from './FeedActions';
import { feedCardLayout } from './FeedCard';
import { Avatar, Button, onBrand, styles, usePalette } from './ui';

export function SocialPostCard({ post, viewer, onLike, onSave, onFollow, feedSwipe }: {
  post: SocialPost; viewer?: string; onLike: (value: boolean) => void; onSave: () => void; onFollow: () => void;
  feedSwipe?: ReturnType<typeof Gesture.Pan>;
}) {
  const p = usePalette();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [slide, setSlide] = useState(0);
  const [measuredWidth, setMeasuredWidth] = useState<number>();
  const mediaWidth = Math.max(1, measuredWidth ?? width - 84);
  const lastTap = useRef(0);
  const heart = useSharedValue(0);
  const animation = useAnimatedStyle(() => ({ opacity: Math.min(1, heart.value), transform: [{ scale: heart.value }] }));
  const mediaSwipe = useMemo(() => feedSwipe ? Gesture.Native().blocksExternalGesture(feedSwipe) : undefined, [feedSwipe]);
  const open = () => router.push({ pathname: '/post/[id]', params: { id: post.id } });
  const openComments = () => router.push({ pathname: '/post/comments', params: { id: post.id } });
  const author = post.author?.display_name ?? t.unavailable;
  const category = post.trip_preview ? t[post.trip_preview.type] : post.video ? t.reels : t.post;

  function likePhoto() {
    const now = Date.now();
    if (now - lastTap.current < 280) {
      lastTap.current = 0;
      heart.set(0);
      heart.set(withSequence(
        withTiming(1.15, { duration: 190, reduceMotion: ReduceMotion.System }),
        withTiming(1, { duration: 170, reduceMotion: ReduceMotion.System }),
        withTiming(0, { duration: 240, reduceMotion: ReduceMotion.System }),
      ));
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      if (!post.liked) onLike(true);
    } else lastTap.current = now;
  }

  const photos = post.photos.map((photo) => <Pressable key={photo.id} onPress={likePhoto} accessibilityLabel={t.like}
    style={{ width: mediaWidth }}>
    <Image source={photo.uri} placeholder={photo.thumbnail} contentFit="cover" placeholderContentFit="cover"
      cachePolicy="memory" recyclingKey={photo.id} style={[feedCardLayout.photo, { backgroundColor: p.soft }]} />
  </Pressable>);
  const carousel = <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}
    onMomentumScrollEnd={({ nativeEvent }) => setSlide(Math.round(nativeEvent.contentOffset.x / mediaWidth))}>{photos}</ScrollView>;

  return <View style={[feedCardLayout.card, { backgroundColor: p.surface, borderColor: p.line }]}>
    <Pressable accessibilityRole="button" accessibilityLabel={author} hitSlop={4}
      onPress={() => router.push({ pathname: '/user/[id]', params: { id: post.user_id } })}>
      {post.author?.avatar_url ? <Image source={post.author.avatar_url} style={feedCardLayout.avatar} /> : <Avatar size={40} />}
    </Pressable>
    <View style={feedCardLayout.body} onLayout={({ nativeEvent }) => setMeasuredWidth(nativeEvent.layout.width)}>
      <View style={cardStyles.header}>
        <View style={[feedCardLayout.identity, cardStyles.authorText]}>
          <Text numberOfLines={1} style={[feedCardLayout.name, { color: p.ink }]}>{author}</Text>
          <Text style={[feedCardLayout.meta, { color: p.muted }]}>{category} · {relativeDate(post.created_at.slice(0, 10))}</Text>
        </View>
        {viewer !== post.user_id && <Pressable accessibilityRole="button" onPress={onFollow} style={cardStyles.follow}>
          <Text style={{ color: post.followed ? p.muted : p.accent, fontWeight: '700', fontSize: 12 }}>
            {post.followed ? t.unfollow : t.follow}
          </Text>
        </Pressable>}
      </View>
      {!!post.caption && <Text numberOfLines={expanded ? undefined : 3} style={[feedCardLayout.copy, { color: p.ink }]}>{post.caption}</Text>}
      {post.caption.length > 100 && <Text accessibilityRole="button" style={{ color: p.accent }}
        onPress={() => setExpanded(!expanded)}>{expanded ? t.less : t.more}</Text>}
      {post.video && <Button label={t.playReel} icon="play-outline" onPress={open} />}
      {photos.length > 0 && <View style={cardStyles.media}>
        {photos.length === 1 ? photos : mediaSwipe ? <GestureDetector gesture={mediaSwipe}>{carousel}</GestureDetector> : carousel}
        <Animated.View pointerEvents="none" style={[cardStyles.heart, animation]}>
          <Ionicons name="heart" size={68} color={onBrand} />
        </Animated.View>
        {photos.length > 1 && <View style={cardStyles.dots}>
          {post.photos.map((photo, index) => <View key={photo.id}
            style={[cardStyles.dot, { backgroundColor: slide === index ? p.accent : p.line }]} />)}
        </View>}
      </View>}
      <FeedActions liked={post.liked} saved={post.saved} likes={post.likes_count} comments={post.comments_count}
        onComment={openComments} onLike={() => onLike(!post.liked)} onSave={onSave}
        onShare={() => { void Share.share({ message: post.caption || t.app }).catch(() => {}); }} />
      {!!post.latestComment && <Text numberOfLines={1} style={{ color: p.ink }}>
        <Text style={feedCardLayout.name}>{post.latestComment.author?.display_name ?? t.unavailable}</Text> {post.latestComment.body}
      </Text>}
      <Pressable accessibilityRole="button" onPress={openComments} style={cardStyles.commentLink}>
        <Text style={{ color: p.accent }}>{post.comments_count ? t.openCommentCount(post.comments_count) : t.commentPlaceholder}</Text>
      </Pressable>
      {(post.spot_id || post.trip_id) && <View style={styles.row}>
        {post.spot_id && <Button label={t.openSpot} onPress={() => router.push({ pathname: '/spot/[id]', params: { id: post.spot_id! } })} />}
        {post.trip_id && (viewer === post.user_id || post.trip_preview) && <Button label={t.openOuting}
          onPress={viewer === post.user_id
            ? () => router.push({ pathname: '/outing/[id]', params: { id: post.trip_id! } })
            : open} />}
      </View>}
    </View>
  </View>;
}

const cardStyles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 32 },
  authorText: { flex: 1, minWidth: 0 },
  follow: { maxWidth: '42%', minHeight: 44, justifyContent: 'center' },
  media: { borderRadius: 16, overflow: 'hidden' },
  heart: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 5, paddingTop: 7 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  commentLink: { alignSelf: 'flex-start', minHeight: 36, justifyContent: 'center' },
});
