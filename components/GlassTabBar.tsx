import { Ionicons } from '@expo/vector-icons';
import { BlurTargetView, BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { ComponentRef, createContext, createRef, PropsWithChildren, useContext, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '../i18n';
import { IconName, usePalette } from './ui';

export const tabNames = ['index', 'map', 'explore', 'profile'] as const;
type TabName = typeof tabNames[number];
const icons: Record<TabName, IconName> = {
  index: 'home-outline', map: 'map-outline', explore: 'compass-outline', profile: 'person-outline',
};
type Targets = Record<TabName, ReturnType<typeof createRef<ComponentRef<typeof View>>>>;
const TargetContext = createContext<Targets | null>(null);

export function GlassTargets({ children }: PropsWithChildren) {
  const [targets] = useState<Targets>(() => ({
    index: createRef<ComponentRef<typeof View>>(), map: createRef<ComponentRef<typeof View>>(), explore: createRef<ComponentRef<typeof View>>(), profile: createRef<ComponentRef<typeof View>>(),
  }));
  return <TargetContext.Provider value={targets}>{children}</TargetContext.Provider>;
}

export function TabContent({ name, children }: PropsWithChildren<{ name: TabName }>) {
  const target = useContext(TargetContext)?.[name];
  return Platform.OS === 'android'
    ? <BlurTargetView ref={target} style={styles.fill}>{children}</BlurTargetView>
    : <View style={styles.fill}>{children}</View>;
}

type Props = BottomTabBarProps & { onCreate: () => void };

export function GlassTabBar({ state, descriptors, emitter, navigateToTab, onCreate }: Props) {
  const p = usePalette();
  const inset = useSafeAreaInsets();
  const targets = useContext(TargetContext);
  const [width, setWidth] = useState(0);
  const active = state.routes[state.index]?.name as TabName;
  const offset = useSharedValue(0);
  const scale = useSharedValue(1);
  const slot = width / 5;
  const position = tabNames.indexOf(active);
  const slotIndex = position < 2 ? position : position + 1;

  useEffect(() => {
    offset.value = withSpring(Math.max(0, slotIndex) * slot, { reduceMotion: ReduceMotion.System });
  }, [offset, slot, slotIndex]);
  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));
  const plus = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const nativeGlass = Platform.OS === 'ios' && isGlassEffectAPIAvailable() && isLiquidGlassAvailable();
  const blur = Platform.OS === 'ios' || (Platform.OS === 'android' && Number(Platform.Version) >= 31);
  const target = targets?.[active];

  function tab(name: TabName) {
    const route = state.routes.find((item) => item.name === name);
    if (!route) return null;
    const selected = name === active;
    const label = descriptors[route.key].options.title ?? t.home;
    return (
      <Pressable key={name} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected }}
        style={styles.slot}
        onLongPress={() => emitter.emit({ type: 'tabLongPress', target: route.key })}
        onPress={() => {
          const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!selected && !event.defaultPrevented) navigateToTab(route.key);
        }}>
        <Ionicons name={icons[name]} size={23} color={selected ? p.accent : p.muted} />
        {selected && <Text numberOfLines={1} style={[styles.label, { color: p.accent }]}>{label}</Text>}
      </Pressable>
    );
  }

  return (
    <View pointerEvents="box-none" style={[styles.outer, { bottom: Math.max(inset.bottom, 9) + 8, shadowColor: '#14251D' }]}>
      <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={[styles.pill, {
        backgroundColor: nativeGlass ? 'transparent' : blur ? p.glass : p.glassSolid,
        borderColor: p.dark ? '#FFFFFF33' : '#FFFFFFEA',
      }]}>
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {nativeGlass ? <GlassView glassEffectStyle="regular" style={StyleSheet.absoluteFill} />
            : blur && <BlurView key={active} blurTarget={target}
              experimentalBlurMethod="dimezisBlurView"
              tint={p.dark ? 'dark' : 'light'} intensity={35} style={StyleSheet.absoluteFill} />}
        </View>
        {width > 0 && <Animated.View pointerEvents="none" style={[styles.indicator,
          { width: Math.max(0, slot - 8), backgroundColor: p.soft }, indicator]} />}
        {tab('index')}
        {tab('map')}
        <Pressable accessibilityRole="button" accessibilityLabel={t.create} style={styles.slot}
          onPressIn={() => { scale.value = withSpring(0.88); }}
          onPressOut={() => { scale.value = withSpring(1); }}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            onCreate();
          }}>
          <Animated.View style={[styles.plus, { backgroundColor: p.accent }, plus]}>
            <Ionicons name="add" size={29} color={p.dark ? '#12251B' : '#FFFFFF'} />
          </Animated.View>
        </Pressable>
        {tab('explore')}
        {tab('profile')}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  outer: { position: 'absolute', left: 16, right: 16, borderRadius: 34, elevation: 5,
    shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 5 } },
  pill: { height: 66, flexDirection: 'row', borderRadius: 34, borderWidth: 1, overflow: 'hidden' },
  slot: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  indicator: { position: 'absolute', top: 7, bottom: 7, left: 4, borderRadius: 25 },
  label: { fontSize: 10, fontWeight: '700', maxWidth: '100%' },
  plus: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center' },
});
