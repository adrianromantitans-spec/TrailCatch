import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { Outing, photoList } from '../db/model';
import { relativeDate, t } from '../i18n';
import { photoSource } from '../services/photos';
import { Avatar, IconButton, side, usePalette } from './ui';

export function FeedCard({ item, onLike, onSave, onComment }: {
  item: Outing; onLike: () => void; onSave: () => void; onComment: () => void;
}) {
  const p = usePalette();
  const photo = photoList(item)[0];
  const destination = { pathname: '/outing/[id]' as const, params: { id: item.id } };
  return (
    <View style={[styles.card, { borderColor: p.line, backgroundColor: p.surface }]}>
      <Link href={destination} asChild>
        <Pressable style={styles.author}>
          <Avatar sample={item.sample} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ color: p.ink, fontWeight: '700' }}>{item.sample ? t.sampleAuthor : t.personal}</Text>
            <Text style={{ color: p.muted, fontSize: 12 }}>{t[item.type]}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={p.muted} />
        </Pressable>
      </Link>
      {photo && <Link href={destination} asChild>
        <Pressable accessibilityLabel={item.title}>
          <Image source={photoSource(photo)} contentFit="cover" transition={160}
            accessibilityLabel={item.title} style={[styles.photo, { backgroundColor: p.soft }]} />
        </Pressable>
      </Link>}
      <View style={styles.actions}>
        <IconButton name={item.liked ? 'heart' : 'heart-outline'} label={item.liked ? t.unlike : t.like}
          color={item.liked ? p.danger : undefined} onPress={onLike} />
        <IconButton name="chatbubble-outline" label={t.comment} onPress={onComment} />
        <View style={{ flex: 1 }} />
        <IconButton name={item.saved ? 'bookmark' : 'bookmark-outline'} label={item.saved ? t.unbookmark : t.bookmark} onPress={onSave} />
        <IconButton name="share-outline" label={t.share} onPress={() => {
          void Share.share({ message: [item.title, item.notes].filter(Boolean).join('\n') }).catch(() => {});
        }} />
      </View>
      <View style={styles.caption}>
        <Text style={{ color: p.ink, fontWeight: '700' }}>{t.likes(item.likes)}</Text>
        <Text style={{ color: p.ink, lineHeight: 20 }}>
          <Text style={{ fontWeight: '700' }}>{item.title}</Text>{item.notes ? `  ${item.notes}` : ''}
        </Text>
        <Text style={{ color: p.muted, fontSize: 12 }}>{relativeDate(item.date)}</Text>
      </View>
    </View>
  );
}

export function FeedSkeleton() {
  const p = usePalette();
  return <View accessibilityLabel={t.loading} style={{ backgroundColor: p.surface }}>
    <View style={styles.author}>
      <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: p.soft }} />
      <View style={{ gap: 7 }}>
        <View style={{ width: 110, height: 11, borderRadius: 5, backgroundColor: p.soft }} />
        <View style={{ width: 62, height: 9, borderRadius: 5, backgroundColor: p.soft }} />
      </View>
    </View>
    <View style={[styles.photo, { backgroundColor: p.soft }]} />
    <View style={{ margin: side, height: 12, width: 145, borderRadius: 6, backgroundColor: p.soft }} />
  </View>;
}

const styles = StyleSheet.create({
  card: { borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: 8 },
  author: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: side, paddingVertical: 10 },
  photo: { width: '100%', aspectRatio: 4 / 5 },
  actions: { flexDirection: 'row', paddingHorizontal: 12, paddingTop: 3 },
  caption: { paddingHorizontal: side, paddingBottom: 15, gap: 5 },
});
