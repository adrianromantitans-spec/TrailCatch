import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { Outing, photoList } from '../db/model';
import { relativeDate, t } from '../i18n';
import { photoSource } from '../services/photos';
import type { Profile } from '../services/social';
import { FeedActions } from './FeedActions';
import { FeedPhotos, useFeedPhotoFrame } from './FeedPhotos';
import type { FeedSwipe } from './FeedPhotos';
import { Avatar, styles, usePalette } from './ui';

type FeedAuthor = Pick<Profile, 'display_name' | 'avatar_url'>;
const cardSide = 16;
const avatarGap = 6;
export const feedCardAvatarSize = 32;

export function FeedCard({ item, author, onLike, onSave, onComment, feedSwipe }: {
  item: Outing; author?: FeedAuthor; onLike: () => void; onSave: () => void; onComment: () => void;
  feedSwipe?: FeedSwipe;
}) {
  const p = usePalette();
  const name = item.sample ? t.sampleAuthor : author?.display_name || t.personal;
  const destination = { pathname: '/outing/[id]' as const, params: { id: item.id } };
  return <View style={[feedCardLayout.card, { borderColor: p.line, backgroundColor: p.surface }]}>
    <Link href={destination} asChild>
      <Pressable accessibilityLabel={item.title} hitSlop={4}>
        {!item.sample && author?.avatar_url ? <Image source={author.avatar_url} style={feedCardLayout.avatar} /> :
          <Avatar sample={item.sample} size={feedCardAvatarSize} />}
      </Pressable>
    </Link>
    <View style={feedCardLayout.body}>
      <View style={feedCardLayout.identity}>
        <Text style={[feedCardLayout.name, { color: p.ink }]}>{name}</Text>
        <Text style={[feedCardLayout.meta, { color: p.muted }]}>{t[item.type]} · {relativeDate(item.date)}</Text>
      </View>
      <Link href={destination} asChild>
        <Pressable>
          <Text style={[feedCardLayout.copy, { color: p.ink }]}>
            <Text style={feedCardLayout.name}>{item.title}</Text>{item.notes ? `\n${item.notes}` : ''}
          </Text>
        </Pressable>
      </Link>
      <FeedPhotos photos={photoList(item)} feedSwipe={feedSwipe} photoKey={(photo, index) =>
        `${'uri' in photo ? photo.uri : photo.sample}-${index}`} renderPhoto={(photo) => <Link href={destination} asChild>
          <Pressable accessibilityLabel={item.title} style={styles.screen}>
            <Image source={photoSource(photo)} contentFit="cover" transition={160}
              accessibilityLabel={item.title} style={[StyleSheet.absoluteFill, { backgroundColor: p.soft }]} />
          </Pressable>
        </Link>} />
      <FeedActions liked={item.liked} saved={item.saved} likes={item.likes} comments={item.comments.length}
        onLike={onLike} onSave={onSave} onComment={onComment}
        onShare={() => { void Share.share({ message: [item.title, item.notes].filter(Boolean).join('\n') }).catch(() => {}); }} />
    </View>
  </View>;
}

export function FeedSkeleton() {
  const p = usePalette();
  const photoFrame = useFeedPhotoFrame();
  return <View accessibilityLabel={t.loading} style={[feedCardLayout.card, { borderColor: p.line, backgroundColor: p.surface }]}>
    <View style={[feedCardLayout.avatar, { backgroundColor: p.soft }]} />
    <View style={feedCardLayout.body}>
      <View style={{ width: 110, height: 11, borderRadius: 5, backgroundColor: p.soft }} />
      <View style={{ width: 62, height: 9, borderRadius: 4, backgroundColor: p.soft }} />
      <View style={[photoFrame, { backgroundColor: p.soft }]} />
    </View>
  </View>;
}

export const feedCardLayout = StyleSheet.create({
  card: { paddingHorizontal: cardSide, paddingVertical: 12, flexDirection: 'row', gap: avatarGap,
    borderBottomWidth: StyleSheet.hairlineWidth },
  avatar: { width: feedCardAvatarSize, height: feedCardAvatarSize, borderRadius: feedCardAvatarSize / 2 },
  body: { flex: 1, minWidth: 0, gap: 12 },
  identity: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 8, rowGap: 2 },
  name: { fontWeight: '700', fontSize: 15, flexShrink: 1 },
  meta: { fontSize: 12 },
  copy: { fontSize: 15, lineHeight: 21 },
});
