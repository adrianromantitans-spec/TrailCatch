import { Ionicons } from '@expo/vector-icons';
import { BlurTargetView, BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { ComponentRef, createContext, createRef, PropsWithChildren, useContext, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import type { ViewStyle } from 'react-native';
import Animated, { Easing, interpolateColor, ReduceMotion, useAnimatedScrollHandler, useAnimatedStyle, useDerivedValue,
  useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import type { AnimatedStyle, SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '../i18n';
import { brandGreen, IconName, onBrand, side, usePalette } from './ui';

const barHeight = 68;
const compactBarHeight = 54;
const compactSideInset = 12;
const tabCount = 5;
const pillInset = 6;
const tabMotion = {
  // Reanimated uses a perceptual duration. The spring settles in about 410 ms.
  slideDuration: 275,
  dampingRatio: 0.78,
  edgeOverrun: 3,
  tintDuration: 190,
  popScale: 1.15,
  popUp: 85,
  popDown: 170,
  pressScale: 0.98,
  pressDuration: 110,
};
const barBottom = (inset: number) => Math.max(inset, 8) + 8;

export function useTabClearance() {
  const { bottom } = useSafeAreaInsets();
  const nativeBar = useContext(TargetContext)?.nativeBar;
  return nativeBar ? bottom + 16 : barHeight + barBottom(bottom) + 16;
}

export const tabNames = ['index', 'map', 'explore', 'profile'] as const;
type TabName = typeof tabNames[number];
const icons: Record<TabName, IconName> = {
  index: 'home-outline', map: 'map-outline', explore: 'search-outline', profile: 'person-outline',
};
type Targets = Record<TabName, ReturnType<typeof createRef<ComponentRef<typeof View>>>>;
const TargetContext = createContext<{ targets: Targets; homeCompact?: SharedValue<boolean>; nativeBar: boolean } | null>(null);

export function GlassTargets({ children, nativeBar = false }: PropsWithChildren<{ nativeBar?: boolean }>) {
  const [targets] = useState<Targets>(() => ({
    index: createRef<ComponentRef<typeof View>>(), map: createRef<ComponentRef<typeof View>>(), explore: createRef<ComponentRef<typeof View>>(), profile: createRef<ComponentRef<typeof View>>(),
  }));
  const homeCompact = useSharedValue(false);
  return <TargetContext.Provider value={{ targets, homeCompact: nativeBar ? undefined : homeCompact, nativeBar }}>{children}</TargetContext.Provider>;
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

function GlassTabItem({ name, label, selected, accent, muted, captionLayout, onPressIn, onPressOut, onLongPress, onSelect }: {
  name: TabName; label: string; selected: boolean; accent: string; muted: string; captionLayout: AnimatedStyle<ViewStyle>;
  onPressIn: () => void; onPressOut: () => void; onLongPress: () => void; onSelect: () => boolean;
}) {
  const pop = useSharedValue(1);
  const tint = useDerivedValue(() => withTiming(selected ? 1 : 0, {
    duration: tabMotion.tintDuration, easing: Easing.inOut(Easing.cubic), reduceMotion: ReduceMotion.System,
  }));
  const iconMotion = useAnimatedStyle(() => ({ transform: [{ scale: pop.get() }] }));
  const iconTint = useAnimatedStyle(() => ({ opacity: tint.get() }));
  const labelMotion = useAnimatedStyle(() => {
    const progress = tint.get();
    return { color: interpolateColor(progress, [0, 1], [muted, accent]), opacity: 1 - 1.6 * progress * (1 - progress) };
  });

  return <Pressable accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected }}
    style={styles.slot} onPressIn={onPressIn} onPressOut={onPressOut} onLongPress={onLongPress} onPress={() => {
      if (!onSelect()) return;
      pop.set(withSequence(ReduceMotion.System,
        withTiming(tabMotion.popScale, { duration: tabMotion.popUp, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: tabMotion.popDown, easing: Easing.inOut(Easing.cubic) }),
      ));
    }}>
    <Animated.View style={[styles.tabIcon, iconMotion]}>
      <Ionicons name={icons[name]} size={23} color={muted} />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.tabIcon, iconTint]}>
        <Ionicons name={icons[name]} size={23} color={accent} />
      </Animated.View>
    </Animated.View>
    <Animated.View style={[styles.caption, captionLayout]}>
      <Animated.Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} maxFontSizeMultiplier={1.2}
        style={[styles.label, labelMotion]}>{label}</Animated.Text>
    </Animated.View>
  </Pressable>;
}

export function GlassTabBar({ state, descriptors, emitter, navigateToTab, onCreate }: Props) {
  const p = usePalette();
  const inset = useSafeAreaInsets();
  const context = useContext(TargetContext);
  const homeCompact = context?.homeCompact;
  const width = Math.max(0, useWindowDimensions().width - inset.left - inset.right - side * 2);
  const active = state.routes[state.index]?.name as TabName;
  const position = tabNames.indexOf(active);
  const slotIndex = Math.max(0, position < 2 ? position : position + 1);
  const selectedSlot = useSharedValue(slotIndex);
  const scale = useSharedValue(1);
  const barScale = useSharedValue(1);

  useEffect(() => {
    selectedSlot.set(withSpring(slotIndex, {
      duration: tabMotion.slideDuration, dampingRatio: tabMotion.dampingRatio, reduceMotion: ReduceMotion.System,
    }));
  }, [selectedSlot, slotIndex]);

  const compact = useDerivedValue(() => withTiming(active === 'index' && homeCompact?.get() ? 1 : 0, {
    duration: 235, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System,
  }));
  // Keep at least 44 points per slot after the pill narrows.
  const maxInset = Math.max(0, Math.min(compactSideInset, (width - tabCount * 44 - 2) / 2));
  const frame = useAnimatedStyle(() => {
    const height = barHeight - (barHeight - compactBarHeight) * compact.get();
    return { height, borderRadius: height / 2, marginHorizontal: maxInset * compact.get(), transform: [{ scale: barScale.get() }] };
  });
  const corners = useAnimatedStyle(() => ({ borderRadius: (barHeight - (barHeight - compactBarHeight) * compact.get()) / 2 }));
  const indicator = useAnimatedStyle(() => {
    const slot = Math.max(0, width - 2 - 2 * maxInset * compact.get()) / tabCount;
    const translateX = Math.max(-tabMotion.edgeOverrun,
      Math.min((tabCount - 1) * slot + tabMotion.edgeOverrun, selectedSlot.get() * slot));
    return { width: Math.max(0, slot - 2 * pillInset), transform: [{ translateX }] };
  });
  const labelMotion = useAnimatedStyle<ViewStyle>(() => {
    const visible = 1 - compact.get();
    return { opacity: visible, height: 16 * visible, marginTop: 2 * visible };
  });
  const plus = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() * (1 - compact.get() * 0.09) / barScale.get() }] }));
  const nativeGlass = Platform.OS === 'ios' && isGlassEffectAPIAvailable() && isLiquidGlassAvailable();
  const blur = Platform.OS === 'ios' || (Platform.OS === 'android' && Number(Platform.Version) >= 31);
  const target = context?.targets[active];

  function pressBar(pressed: boolean) {
    barScale.set(withTiming(pressed ? tabMotion.pressScale : 1, {
      duration: tabMotion.pressDuration, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System,
    }));
  }

  function tab(name: TabName) {
    const route = state.routes.find((item) => item.name === name);
    if (!route) return null;
    const selected = name === active;
    const label = descriptors[route.key].options.title ?? t.home;
    return (
      <GlassTabItem key={name} name={name} selected={selected} label={label} accent={p.accent} muted={p.muted}
        captionLayout={labelMotion} onPressIn={() => pressBar(true)} onPressOut={() => pressBar(false)}
        onLongPress={() => emitter.emit({ type: 'tabLongPress', target: route.key })}
        onSelect={() => {
          const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (event.defaultPrevented) return false;
          if (!selected) {
            navigateToTab(route.key);
            if (Platform.OS === 'ios' || Platform.OS === 'android') void Haptics.selectionAsync().catch(() => {});
          }
          return true;
        }} />
    );
  }

  return (
    <View pointerEvents="box-none"
      style={[styles.outer, { bottom: barBottom(inset.bottom), left: inset.left + side, right: inset.right + side }]}>
      <Animated.View style={[styles.shadow, frame]}>
        <Animated.View style={[styles.pill, corners, {
          backgroundColor: nativeGlass ? 'transparent' : blur ? p.glass : p.glassSolid,
          borderColor: nativeGlass ? '#FFFFFFA6' : p.line,
        }]}>
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            {nativeGlass ? <GlassView glassEffectStyle="regular" colorScheme="light"
                tintColor="#FFFFFF66" style={StyleSheet.absoluteFill} />
              : blur && <BlurView key={active} blurTarget={target}
                experimentalBlurMethod="dimezisBlurView"
                tint="light" intensity={35} style={StyleSheet.absoluteFill} />}
          </View>
          <View style={styles.tabRow}>
            {width > 0 && <Animated.View pointerEvents="none" style={[styles.indicator,
              { backgroundColor: nativeGlass ? '#E7F1EBD9' : p.soft }, indicator]} />}
            {tab('index')}
            {tab('map')}
            <Pressable accessibilityRole="button" accessibilityLabel={t.createMenu} style={styles.slot}
              onPressIn={() => { scale.set(withSpring(0.88)); }}
              onPressOut={() => { scale.set(withSpring(1)); }}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                onCreate();
              }}>
              <Animated.View style={[styles.plus, { backgroundColor: brandGreen }, plus]}>
                <Ionicons name="add" size={24} color={onBrand} />
              </Animated.View>
              <Animated.View style={[styles.caption, labelMotion]}>
                <Animated.Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} maxFontSizeMultiplier={1.2}
                  style={[styles.label, { color: p.accent }]}>{t.createMenu}</Animated.Text>
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
  tabIcon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  slot: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center' },
  indicator: { position: 'absolute', top: pillInset, bottom: pillInset, left: pillInset, borderRadius: 28 },
  caption: { alignSelf: 'stretch', overflow: 'hidden', justifyContent: 'center', paddingHorizontal: 2 },
  label: { fontSize: 11, includeFontPadding: false, textAlign: 'center', fontWeight: '700' },
  plus: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
});
