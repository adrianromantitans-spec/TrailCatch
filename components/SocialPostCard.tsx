import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { relativeDate, t } from '../i18n';
import type { SocialPost } from '../services/social';
import { Avatar, Button, IconButton, side, styles, usePalette } from './ui';

export function SocialPostCard({ post, viewer, onLike, onSave, onFollow }: {
  post: SocialPost; viewer?: string; onLike: (value: boolean) => void; onSave: () => void; onFollow: () => void;
}) {
  const p = usePalette();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [slide, setSlide] = useState(0);
  const lastTap = useRef(0);
  const heart = useSharedValue(0);
  const animation = useAnimatedStyle(() => ({ opacity: Math.min(1, heart.value), transform: [{ scale: heart.value }] }));
  const open = () => router.push({ pathname: '/post/[id]', params: { id: post.id } });

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

  return <View style={[cardStyles.card, { backgroundColor: p.surface, borderColor: p.line }]}>
    <View style={cardStyles.header}>
      <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/user/[id]', params: { id: post.user_id } })}
        style={cardStyles.identity}>
        {post.author?.avatar_url ? <Image source={post.author.avatar_url} style={cardStyles.avatar} /> : <Avatar />}
        <Text numberOfLines={1} style={[cardStyles.name, { color: p.ink }]}>{post.author?.display_name ?? t.unavailable}</Text>
      </Pressable>
      {viewer !== post.user_id && <Button label={post.followed ? t.unfollow : t.follow} onPress={onFollow} />}
    </View>
    {post.video && <View style={{ paddingHorizontal: side }}>
      <Button label={t.playReel} icon="play-outline" onPress={open} />
    </View>}
    {post.photos.length > 0 && <View>
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={({ nativeEvent }) => setSlide(Math.round(nativeEvent.contentOffset.x / width))}>
        {post.photos.map((photo) => <Pressable key={photo.id} onPress={likePhoto} accessibilityLabel={t.like}>
          <Image source={photo.uri} placeholder={photo.thumbnail} contentFit="cover" placeholderContentFit="cover"
            cachePolicy="memory" recyclingKey={photo.id} style={{ width, aspectRatio: 4 / 5, backgroundColor: p.soft }} />
        </Pressable>)}
      </ScrollView>
      <Animated.View pointerEvents="none" style={[cardStyles.heart, animation]}>
        <Ionicons name="heart" size={86} color="#FFFFFF" />
      </Animated.View>
      {post.photos.length > 1 && <View style={cardStyles.dots}>
        {post.photos.map((photo, index) => <View key={photo.id} style={[cardStyles.dot, { backgroundColor: slide === index ? p.accent : p.line }]} />)}
      </View>}
    </View>}
    <View style={cardStyles.actions}>
      <IconButton name={post.liked ? 'heart' : 'heart-outline'} label={post.liked ? t.unlike : t.like}
        color={post.liked ? p.danger : undefined} onPress={() => onLike(!post.liked)} />
      <IconButton name="chatbubble-outline" label={t.comment} onPress={open} />
      <View style={styles.screen} />
      <IconButton name={post.saved ? 'bookmark' : 'bookmark-outline'} label={post.saved ? t.unbookmark : t.bookmark} onPress={onSave} />
      <IconButton name="share-outline" label={t.share} onPress={() => {
        void Share.share({ message: post.caption || t.app }).catch(() => {});
      }} />
    </View>
    <View style={cardStyles.text}>
      <Text style={[cardStyles.name, { color: p.ink }]}>{t.likes(post.likes_count)}</Text>
      {!!post.caption && <Text numberOfLines={expanded ? undefined : 3} style={{ color: p.ink }}>{post.caption}</Text>}
      {post.caption.length > 100 && <Text style={{ color: p.accent }} onPress={() => setExpanded(!expanded)}>{expanded ? t.less : t.more}</Text>}
      <Text style={{ color: p.muted }}>{relativeDate(post.created_at.slice(0, 10))}</Text>
      <View style={styles.row}>
        {post.spot_id && <Button label={t.openSpot} onPress={() => router.push({ pathname: '/spot/[id]', params: { id: post.spot_id! } })} />}
        {post.trip_id && (viewer === post.user_id || post.trip_preview) && <Button label={t.openOuting}
          onPress={viewer === post.user_id
            ? () => router.push({ pathname: '/outing/[id]', params: { id: post.trip_id! } })
            : open} />}
        <Button label={t.comments} onPress={open} />
      </View>
    </View>
  </View>;
}

const cardStyles = StyleSheet.create({
  card: { borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: 8 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: side, paddingVertical: 10, gap: 12 },
  identity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { fontWeight: '700', flexShrink: 1 },
  avatar: { width: 38, height: 38, borderRadius: 19 },
  heart: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 5, paddingVertical: 7 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  actions: { flexDirection: 'row', paddingHorizontal: 8, gap: 12 },
  text: { paddingHorizontal: side, paddingBottom: 16, gap: 6 },
});
