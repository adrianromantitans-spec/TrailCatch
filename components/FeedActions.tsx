import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useDerivedValue, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { PressFeedback as Pressable } from './PressFeedback';
import { locale, t } from '../i18n';
import { lightImpact } from '../services/interaction';
import { usePalette } from './ui';
import type { IconName } from './ui';

const counts = new Intl.NumberFormat(locale, { notation: 'compact' });

export function FeedActions({ liked, saved, likes, comments, onComment, onLike, onSave, onShare }: {
  liked: boolean; saved: boolean; likes: number; comments?: number;
  onComment: () => void; onLike: () => void; onSave: () => void; onShare: () => void;
}) {
  const p = usePalette();
  const scale = useSharedValue(1);
  const fill = useDerivedValue(() => withTiming(liked ? 1 : 0, { duration: 140, reduceMotion: ReduceMotion.System }));
  const bounce = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const outline = useAnimatedStyle(() => ({ opacity: 1 - fill.get() }));
  const filled = useAnimatedStyle(() => ({ opacity: fill.get() }));
  const actions: { id: string; name: IconName; label: string; color: string; onPress: () => void; count?: number; selected?: boolean }[] = [
    { id: 'comment', name: 'chatbubble-outline', label: comments ? t.openCommentCount(comments) : t.comment, color: p.muted, onPress: onComment, count: comments },
    { id: 'like', name: 'heart-outline', label: `${liked ? t.unlike : t.like}, ${t.likes(likes)}`,
      color: liked ? p.danger : p.muted, onPress: () => {
        if (!liked) {
          lightImpact();
          scale.set(withSequence(ReduceMotion.System,
            withTiming(1.27, { duration: 100, easing: Easing.out(Easing.cubic) }),
            withTiming(0.95, { duration: 90 }), withTiming(1, { duration: 100 }),
          ));
        }
        onLike();
      }, count: likes, selected: liked },
    { id: 'save', name: saved ? 'bookmark' : 'bookmark-outline', label: saved ? t.unbookmark : t.bookmark,
      color: saved ? p.accent : p.muted, onPress: () => { if (!saved) lightImpact(); onSave(); }, selected: saved },
    { id: 'share', name: 'share-outline', label: t.share, color: p.muted, onPress: onShare },
  ];
  return <View style={layout.row}>
    {actions.map(({ id, name, label, color, onPress, count, selected }) => <Pressable key={id} cssInterop={false}
      accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }} onPress={onPress}
      style={({ pressed }) => [layout.action, id === 'share' && layout.last,
        { opacity: pressed ? 0.55 : 1 }]}>
      {id === 'like' ? <Animated.View style={[layout.heart, bounce]}>
        <Animated.View style={[StyleSheet.absoluteFill, outline]}><Ionicons name={name} size={22} color={p.muted} /></Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, filled]}><Ionicons name="heart" size={22} color={p.danger} /></Animated.View>
      </Animated.View> : <Ionicons name={name} size={22} color={color} />}
      {count !== undefined && <Text numberOfLines={1} style={[layout.count, { color }]}>{counts.format(count)}</Text>}
    </Pressable>)}
  </View>;
}

const layout = StyleSheet.create({
  row: { width: '100%', height: 44, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  action: { flex: 1, minWidth: 44, height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 6 },
  last: { justifyContent: 'flex-end' },
  count: { flexShrink: 1, fontSize: 12 },
  heart: { width: 22, height: 22 },
});
