import { Ionicons } from '@expo/vector-icons';
import { BlurTargetView, BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { ComponentRef, createContext, createRef, PropsWithChildren, useContext, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedScrollHandler, useAnimatedStyle, useDerivedValue, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '../i18n';
import { brandGreen, IconName, onBrand, side, usePalette } from './ui';

const barHeight = 68;
const compactBarHeight = 54;
const compactSideInset = 12;
const tabCount = 5;
const barBottom = (inset: number) => Math.max(inset, 8) + 8;

export function useTabClearance() {
  return barHeight + barBottom(useSafeAreaInsets().bottom) + 16;
}

export const tabNames = ['index', 'map', 'explore', 'profile'] as const;
type TabName = typeof tabNames[number];
const icons: Record<TabName, IconName> = {
  index: 'home-outline', map: 'map-outline', explore: 'search-outline', profile: 'person-outline',
};
type Targets = Record<TabName, ReturnType<typeof createRef<ComponentRef<typeof View>>>>;
const TargetContext = createContext<{ targets: Targets; homeCompact: SharedValue<boolean> } | null>(null);

export function GlassTargets({ children }: PropsWithChildren) {
  const [targets] = useState<Targets>(() => ({
    index: createRef<ComponentRef<typeof View>>(), map: createRef<ComponentRef<typeof View>>(), explore: createRef<ComponentRef<typeof View>>(), profile: createRef<ComponentRef<typeof View>>(),
  }));
  const homeCompact = useSharedValue(false);
  return <TargetContext.Provider value={{ targets, homeCompact }}>{children}</TargetContext.Provider>;
}

export function TabContent({ name, children }: PropsWithChildren<{ name: TabName }>) {
  const target = useContext(TargetContext)?.targets[name];
  return Platform.OS === 'android'
    ? <BlurTargetView ref={target} style={styles.fill}>{children}</BlurTargetView>
    : <View style={styles.fill}>{children}</View>;
}

type ScrollContext = { y?: number; travel?: number };

export function useHomeTabScroll() {
  const compact = useContext(TargetContext)?.homeCompact;
  const onScroll = useAnimatedScrollHandler<ScrollContext>({
    onBeginDrag(event, context) {
      context.y = Math.max(0, event.contentOffset.y);
      context.travel = 0;
    },
    onScroll(event, context) {
      if (!compact) return;
      const bottom = Math.max(0, event.contentSize.height - event.layoutMeasurement.height);
      const y = Math.max(0, Math.min(bottom, event.contentOffset.y));
      const delta = y - (context.y ?? y);
      context.y = y;
      if (y <= 12) {
        context.travel = 0;
        compact.set(false);
        return;
      }
      if (!delta) return;
      const previous = context.travel ?? 0;
      context.travel = Math.sign(previous) === Math.sign(delta) ? previous + delta : delta;
      if (!compact.get() && y >= 64 && context.travel >= 22) compact.set(true);
      else if (compact.get() && context.travel <= -18) compact.set(false);
    },
  });
  return { onScroll, compact };
}

type Props = BottomTabBarProps & { onCreate: () => void };

export function GlassTabBar({ state, descriptors, emitter, navigateToTab, onCreate }: Props) {
  const p = usePalette();
  const inset = useSafeAreaInsets();
  const context = useContext(TargetContext);
  const homeCompact = context?.homeCompact;
  const width = Math.max(0, useWindowDimensions().width - inset.left - inset.right - side * 2);
  const active = state.routes[state.index]?.name as TabName;
  const selectedSlot = useSharedValue(0);
  const scale = useSharedValue(1);
  const position = tabNames.indexOf(active);
  const slotIndex = position < 2 ? position : position + 1;

  useEffect(() => {
    selectedSlot.set(withSpring(Math.max(0, slotIndex), { reduceMotion: ReduceMotion.System }));
  }, [selectedSlot, slotIndex]);

  const compact = useDerivedValue(() => withTiming(active === 'index' && homeCompact?.get() ? 1 : 0, {
    duration: 235, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System,
  }));
  // Keep at least 44 points per slot after the pill narrows.
  const maxInset = Math.max(0, Math.min(compactSideInset, (width - tabCount * 44 - 2) / 2));
  const frame = useAnimatedStyle(() => {
    const height = barHeight - (barHeight - compactBarHeight) * compact.get();
    return { height, borderRadius: height / 2, marginHorizontal: maxInset * compact.get() };
  });
  const corners = useAnimatedStyle(() => ({ borderRadius: (barHeight - (barHeight - compactBarHeight) * compact.get()) / 2 }));
  const indicator = useAnimatedStyle(() => {
    const slot = Math.max(0, width - 2 - 2 * maxInset * compact.get()) / tabCount;
    return { width: Math.max(0, slot - 8), transform: [{ translateX: selectedSlot.get() * slot }] };
  });
  const labelMotion = useAnimatedStyle(() => ({
    opacity: 1 - compact.get(), transform: [{ translateY: compact.get() * 5 }],
  }));
  const plus = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() * (1 - compact.get() * 0.09) }] }));
  const nativeGlass = Platform.OS === 'ios' && isGlassEffectAPIAvailable() && isLiquidGlassAvailable();
  const blur = Platform.OS === 'ios' || (Platform.OS === 'android' && Number(Platform.Version) >= 31);
  const target = context?.targets[active];

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
        <View style={styles.tabIcon}><Ionicons name={icons[name]} size={23} color={selected ? p.accent : p.muted} /></View>
        {selected && <Animated.Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={[styles.label, labelMotion, { color: p.accent }]}>
          {label}
        </Animated.Text>}
      </Pressable>
    );
  }

  return (
    <View pointerEvents="box-none"
      style={[styles.outer, { bottom: barBottom(inset.bottom), left: inset.left + side, right: inset.right + side }]}>
      <Animated.View style={[styles.shadow, frame]}>
        <Animated.View style={[styles.pill, corners, {
          backgroundColor: nativeGlass ? 'transparent' : blur ? p.glass : p.glassSolid,
          borderColor: nativeGlass ? (p.dark ? '#FFFFFF29' : '#FFFFFF73') : (p.dark ? '#FFFFFF33' : '#FFFFFFEA'),
        }]}>
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            {nativeGlass ? <GlassView glassEffectStyle="regular" colorScheme={p.dark ? 'dark' : 'light'}
                tintColor={p.dark ? '#15281F26' : '#FFFFFF48'} style={StyleSheet.absoluteFill} />
              : blur && <BlurView key={active} blurTarget={target}
                experimentalBlurMethod="dimezisBlurView"
                tint={p.dark ? 'dark' : 'light'} intensity={35} style={StyleSheet.absoluteFill} />}
          </View>
          <View style={styles.tabRow}>
            {width > 0 && <Animated.View pointerEvents="none" style={[styles.indicator,
              { backgroundColor: nativeGlass ? (p.dark ? '#BBEBD226' : '#255A4617') : p.soft }, indicator]} />}
            {tab('index')}
            {tab('map')}
            <Pressable accessibilityRole="button" accessibilityLabel={t.create} style={styles.slot}
              onPressIn={() => { scale.set(withSpring(0.88)); }}
              onPressOut={() => { scale.set(withSpring(1)); }}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                onCreate();
              }}>
              <Animated.View style={[styles.plus, { backgroundColor: brandGreen }, plus]}>
                <Ionicons name="add" size={29} color={onBrand} />
              </Animated.View>
            </Pressable>
            {tab('explore')}
            {tab('profile')}
          </View>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  outer: { position: 'absolute' },
  shadow: { shadowColor: '#14251D', elevation: 5, shadowOpacity: 0.15, shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 } },
  pill: { flex: 1, borderWidth: 1, overflow: 'hidden' },
  tabRow: { flex: 1, flexDirection: 'row' },
  tabIcon: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  slot: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  indicator: { position: 'absolute', top: 5, bottom: 3, left: 4, borderRadius: 28 },
  label: { position: 'absolute', left: 2, right: 2, bottom: 3, fontSize: 10,
    lineHeight: 14, includeFontPadding: false, textAlign: 'center', fontWeight: '700' },
  plus: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
});
