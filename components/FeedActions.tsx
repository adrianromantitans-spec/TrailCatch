import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { locale, t } from '../i18n';
import { usePalette } from './ui';
import type { IconName } from './ui';

const counts = new Intl.NumberFormat(locale, { notation: 'compact' });

export function FeedActions({ liked, saved, likes, comments, onComment, onLike, onSave, onShare }: {
  liked: boolean; saved: boolean; likes: number; comments?: number;
  onComment: () => void; onLike: () => void; onSave: () => void; onShare: () => void;
}) {
  const p = usePalette();
  const actions: { name: IconName; label: string; color: string; onPress: () => void; count?: number; selected?: boolean }[] = [
    { name: 'chatbubble-outline', label: comments ? t.openCommentCount(comments) : t.comment, color: p.muted, onPress: onComment, count: comments },
    { name: liked ? 'heart' : 'heart-outline', label: `${liked ? t.unlike : t.like}, ${t.likes(likes)}`,
      color: liked ? p.danger : p.muted, onPress: onLike, count: likes, selected: liked },
    { name: saved ? 'bookmark' : 'bookmark-outline', label: saved ? t.unbookmark : t.bookmark,
      color: saved ? p.accent : p.muted, onPress: onSave, selected: saved },
    { name: 'share-outline', label: t.share, color: p.muted, onPress: onShare },
  ];
  return <View style={layout.row}>
    {actions.map(({ name, label, color, onPress, count, selected }) => <Pressable key={name} cssInterop={false}
      accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }} onPress={onPress}
      style={({ pressed }) => [layout.action, { opacity: pressed ? 0.55 : 1 }]}>
      <Ionicons name={name} size={20} color={color} />
      {count !== undefined && <Text numberOfLines={1} style={[layout.count, { color }]}>{counts.format(count)}</Text>}
    </Pressable>)}
  </View>;
}

const layout = StyleSheet.create({
  row: { flexDirection: 'row' },
  action: { flex: 1, minWidth: 0, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  count: { flexShrink: 1, fontSize: 12 },
});
