import { Sora_700Bold } from '@expo-google-fonts/sora/700Bold';
import { Image } from 'expo-image';
import { useFonts } from 'expo-font';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { t } from '../i18n';
import { Avatar, IconButton, usePalette } from './ui';

export const homeModes = ['following', 'nearby', 'local'] as const;
export type HomeMode = typeof homeModes[number];
const labels = { following: t.followingFeed, nearby: t.nearbyFeed, local: t.diary };
const rowHeight = 48;
export const homeHeaderHeight = (tabs: boolean) => rowHeight * (tabs ? 2 : 1);

export function HomeHeader({ mode, hasTabs, avatarUrl, unread, offset, onProfile, onNotifications, onSelect }: {
  mode: HomeMode; hasTabs: boolean; avatarUrl?: string | null; unread: boolean; offset: SharedValue<number>;
  onProfile: () => void; onNotifications: () => void; onSelect: (mode: HomeMode) => void;
}) {
  const p = usePalette();
  const { width } = useWindowDimensions();
  const [loaded] = useFonts({ Sora_700Bold });
  const [failedAvatar, setFailedAvatar] = useState<string>();
  const motion = useAnimatedStyle(() => ({ transform: [{ translateY: -offset.get() }] }));
  const activeIndex = homeModes.indexOf(mode);
  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: withTiming(activeIndex * width / homeModes.length, {
    duration: 190, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System,
  }) }] }));

  return <Animated.View style={[layout.header, motion, { backgroundColor: p.surface }]}>
    <View style={[layout.top, { borderColor: p.line }]}>
      <View pointerEvents="none" style={layout.center}>
        <Text accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}
          style={[layout.wordmark, { color: p.accent }, loaded && layout.sora]}>{t.app}</Text>
      </View>
      <Pressable cssInterop={false} accessibilityRole="button" accessibilityLabel={t.profile} onPress={onProfile}
        style={({ pressed }) => [layout.profile, { opacity: pressed ? 0.55 : 1 }]}>
        {avatarUrl && avatarUrl !== failedAvatar ? <Image source={avatarUrl} recyclingKey={avatarUrl} style={layout.avatar}
          onError={() => setFailedAvatar(avatarUrl)} /> : <Avatar size={32} />}
      </Pressable>
      <View>
        <IconButton name="notifications-outline" label={t.notifications} onPress={onNotifications} />
        {unread && <View pointerEvents="none" style={[layout.badge, { backgroundColor: p.danger }]} />}
      </View>
    </View>
    {hasTabs && <View accessibilityRole="tablist" style={[layout.tabs, { borderColor: p.line }]}>
      {homeModes.map((name) => <Pressable key={name} accessibilityRole="tab" accessibilityState={{ selected: mode === name }}
        onPress={() => onSelect(name)} style={layout.tab}>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}
          style={[layout.tabText, { color: mode === name ? p.ink : p.muted }, mode === name && layout.bold]}>{labels[name]}</Text>
      </Pressable>)}
      <Animated.View pointerEvents="none" style={[layout.indicatorSlot, { width: width / homeModes.length }, indicator]}>
        <View style={[layout.indicator, { backgroundColor: p.accent }]} />
      </Animated.View>
    </View>}
  </Animated.View>;
}

const layout = StyleSheet.create({
  header: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2 },
  top: { height: rowHeight, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  center: { position: 'absolute', left: 64, right: 64, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  wordmark: { fontSize: 24, letterSpacing: -0.5, fontWeight: '700', textAlign: 'center' },
  sora: { fontFamily: 'Sora_700Bold', fontWeight: 'normal' },
  profile: { height: 44, width: 44, justifyContent: 'center', alignItems: 'flex-start' },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  badge: { position: 'absolute', right: 7, top: 8, width: 8, height: 8, borderRadius: 4 },
  tabs: { height: rowHeight, flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, minWidth: 0, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontSize: 15, textAlign: 'center' },
  bold: { fontWeight: '700' },
  indicatorSlot: { position: 'absolute', bottom: 0, left: 0, alignItems: 'center' },
  indicator: { width: 56, maxWidth: '65%', height: 4, borderRadius: 2 },
});
