import { Sora_700Bold } from '@expo-google-fonts/sora/700Bold';
import { Image } from 'expo-image';
import { useFonts } from 'expo-font';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { t } from '../i18n';
import { Avatar, usePalette } from './ui';

export const feedTabHeight = 48;

export function FeedHeader({ title, avatarUrl, onProfile, action, height = 48, controlSize = 44 }: {
  title: string; avatarUrl?: string | null; onProfile: () => void; action?: ReactNode;
  height?: number; controlSize?: number;
}) {
  const p = usePalette();
  const [loaded] = useFonts({ Sora_700Bold });
  const [failedAvatar, setFailedAvatar] = useState<string>();
  const control = { width: controlSize, height: controlSize };

  return <View style={[layout.top, { height, borderColor: p.line }]}>
    <Pressable cssInterop={false} accessibilityRole="button" accessibilityLabel={t.profile} onPress={onProfile}
      style={({ pressed }) => [layout.profile, control, { opacity: pressed ? 0.55 : 1 }]}>
      {avatarUrl && avatarUrl !== failedAvatar ? <Image source={avatarUrl} recyclingKey={avatarUrl} style={layout.avatar}
        onError={() => setFailedAvatar(avatarUrl)} /> : <Avatar size={32} />}
    </Pressable>
    <View pointerEvents="none" style={layout.center}>
      <Text accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}
        style={[layout.wordmark, { color: p.accent }, loaded && layout.sora]}>{title}</Text>
    </View>
    <View style={[layout.action, control]}>{action}</View>
  </View>;
}

export function FeedTabs<T extends string>({ items, labels, selected, onSelect, indicatorWidth = 56 }: {
  items: readonly T[]; labels: Record<T, string>; selected: T; onSelect: (item: T) => void;
  indicatorWidth?: number;
}) {
  const p = usePalette();
  const { width } = useWindowDimensions();
  const [rowWidth, setRowWidth] = useState<number>();
  const tabWidth = (rowWidth ?? width) / items.length;
  const activeIndex = items.indexOf(selected);
  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: withTiming(activeIndex * tabWidth, {
    duration: 190, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System,
  }) }] }));

  return <View accessibilityRole="tablist" style={[layout.tabs, { borderColor: p.line }]}
    onLayout={({ nativeEvent }) => setRowWidth(nativeEvent.layout.width)}>
    {items.map((name) => <Pressable key={name} accessibilityRole="tab" accessibilityState={{ selected: selected === name }}
      onPress={() => onSelect(name)} style={layout.tab}>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}
        style={[layout.tabText, { color: selected === name ? p.ink : p.muted }, selected === name && layout.bold]}>{labels[name]}</Text>
    </Pressable>)}
    <Animated.View pointerEvents="none" style={[layout.indicatorSlot, { width: tabWidth }, indicator]}>
      <View style={[layout.indicator, { width: indicatorWidth, backgroundColor: p.accent }]} />
    </Animated.View>
  </View>;
}

const layout = StyleSheet.create({
  top: { paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  center: { flex: 1, minWidth: 0, justifyContent: 'center' },
  wordmark: { fontSize: 24, letterSpacing: -0.5, fontWeight: '700', textAlign: 'center' },
  sora: { fontFamily: 'Sora_700Bold', fontWeight: 'normal' },
  profile: { justifyContent: 'center', alignItems: 'flex-start' },
  action: { justifyContent: 'center', alignItems: 'flex-end' },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  tabs: { height: feedTabHeight, flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, minWidth: 0, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontSize: 15, textAlign: 'center' },
  bold: { fontWeight: '700' },
  indicatorSlot: { position: 'absolute', bottom: 0, left: 0, alignItems: 'center' },
  indicator: { maxWidth: '100%', height: 4, borderRadius: 2 },
});
