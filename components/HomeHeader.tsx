import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { t } from '../i18n';
import { FeedHeader, FeedTabs, feedTabHeight } from './FeedHeader';
import { IconButton, usePalette } from './ui';

export const homeModes = ['following', 'nearby', 'local'] as const;
export type HomeMode = typeof homeModes[number];
const labels = { following: t.followingFeed, nearby: t.nearbyFeed, local: t.diary };
const topHeight = 56;
const controlSize = 40;
export const homeHeaderHeight = (tabs: boolean) => topHeight + (tabs ? feedTabHeight : 0);

export function HomeHeader({ mode, hasTabs, avatarUrl, unread, offset, onProfile, onNotifications, onSelect }: {
  mode: HomeMode; hasTabs: boolean; avatarUrl?: string | null; unread: boolean; offset: SharedValue<number>;
  onProfile: () => void; onNotifications: () => void; onSelect: (mode: HomeMode) => void;
}) {
  const p = usePalette();
  const motion = useAnimatedStyle(() => ({ transform: [{ translateY: -offset.get() }] }));

  return <Animated.View style={[layout.header, motion, { backgroundColor: p.surface }]}>
    <FeedHeader title={t.app} avatarUrl={avatarUrl} onProfile={onProfile} height={topHeight} controlSize={controlSize} action={<View>
      <IconButton name="notifications-outline" label={t.notifications} onPress={onNotifications} align="end"
        size={controlSize} iconSize={24} />
      {unread && <View pointerEvents="none" style={[layout.badge, { backgroundColor: p.danger }]} />}
    </View>} />
    {hasTabs && <FeedTabs items={homeModes} labels={labels} selected={mode} onSelect={onSelect} indicatorWidth={48} />}
  </Animated.View>;
}

const layout = StyleSheet.create({
  header: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2 },
  badge: { position: 'absolute', right: 1, top: 7, width: 8, height: 8, borderRadius: 4 },
});
