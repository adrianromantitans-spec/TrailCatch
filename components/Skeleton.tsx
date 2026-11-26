import { useEffect } from 'react';
import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { cancelAnimation, Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { t } from '../i18n';

export function Skeleton({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.set(withRepeat(withTiming(0.55, { duration: 900, easing: Easing.inOut(Easing.cubic),
      reduceMotion: ReduceMotion.System }), -1, true, undefined, ReduceMotion.System));
    return () => cancelAnimation(opacity);
  }, [opacity]);
  const motion = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return <Animated.View accessible accessibilityLabel={t.loading} style={[style, motion]}>{children}</Animated.View>;
}

export function SkeletonBlock({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[layout.block, style]} />;
}

export function GridSkeleton({ profile = false, inset = 16 }: { profile?: boolean; inset?: number }) {
  return <Skeleton style={[layout.grid, { paddingHorizontal: inset }]}>
    {profile && <>
      <View style={layout.identity}>
        <SkeletonBlock style={layout.avatar} />
        <View style={layout.grid}>
          <SkeletonBlock style={{ width: 112, height: 16 }} />
          <SkeletonBlock style={{ width: 76, height: 10 }} />
        </View>
      </View>
      <SkeletonBlock style={{ height: 62 }} />
    </>}
    {[0, 1].map((row) => <View key={row} style={layout.row}>
      {[0, 1, 2].map((column) => <SkeletonBlock key={column} style={layout.tile} />)}
    </View>)}
  </Skeleton>;
}

const layout = StyleSheet.create({
  block: { backgroundColor: '#E4E8E6', borderRadius: 10 },
  grid: { gap: 8, paddingVertical: 8 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 72, height: 72, borderRadius: 36 },
  row: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, aspectRatio: 1 },
});
