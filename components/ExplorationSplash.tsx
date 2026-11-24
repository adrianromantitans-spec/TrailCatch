import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation, Easing, ReduceMotion, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Stop } from 'react-native-svg';
import { t } from '../i18n';
import { EntryWordmark } from './EntryWordmark';
import { side, usePalette } from './ui';

export const SPLASH_TIMING = {
  arrival: 400,
  journeyEnd: 2400,
  nameStart: 2460,
  nameEnd: 2760,
  subtitleStart: 2660,
  loginStart: 3000,
  end: 3500,
  reduced: 480,
};

export const SPLASH_SPEED = {
  steering: 2.55,
  road: 0.63,
  parallax: 0.23,
};

const W = 360;
const H = 260;
const HORIZON = 62;
const PATH_END = 286;
const WALKER_Y = 154;
const BEND = 19;
const WAVE_LENGTH = 0.024;
const AnimatedPath = Animated.createAnimatedComponent(Path);
const easeInOut = Easing.inOut(Easing.cubic);
const easeOut = Easing.out(Easing.cubic);
let introPlayed = false;

function range(time: number, start: number, end: number) {
  'worklet';
  return Math.min(1, Math.max(0, (time - start) / (end - start)));
}

function travelTime(time: number) {
  'worklet';
  return Math.min(Math.max(0, time - SPLASH_TIMING.arrival), SPLASH_TIMING.journeyEnd - SPLASH_TIMING.arrival) / 1000;
}

function centerAt(y: number, seconds: number) {
  'worklet';
  const phase = seconds * SPLASH_SPEED.steering;
  return W / 2 + BEND * (Math.sin((y - WALKER_Y) * WAVE_LENGTH + phase) - Math.sin(phase));
}

function halfWidth(y: number) {
  'worklet';
  return 7 + 78 * ((y - HORIZON) / (PATH_END - HORIZON)) ** 1.2;
}

function edge(y: number, seconds: number, side: number) {
  'worklet';
  return centerAt(y, seconds) + side * halfWidth(y);
}

function roadOutline(seconds: number) {
  'worklet';
  let outline = '';
  const segments = 16;
  for (let i = 0; i <= segments; i++) {
    const y = HORIZON + (PATH_END - HORIZON) * (i / segments);
    outline += `${i === 0 ? 'M' : 'L'}${edge(y, seconds, -1).toFixed(1)},${y.toFixed(1)}`;
  }
  for (let i = segments; i >= 0; i--) {
    const y = HORIZON + (PATH_END - HORIZON) * (i / segments);
    outline += `L${edge(y, seconds, 1).toFixed(1)},${y.toFixed(1)}`;
  }
  return `${outline}Z`;
}

function depthY(amount: number) {
  'worklet';
  return HORIZON + (PATH_END - HORIZON) * amount ** 1.72;
}

function roadMarks(seconds: number) {
  'worklet';
  let path = '';
  for (let i = 0; i < 11; i++) {
    const depth = (i / 11 + seconds * SPLASH_SPEED.road) % 1;
    const y = depthY(depth);
    const next = depthY(Math.min(1, depth + 0.043));
    for (const side of [-0.82, 0.82]) {
      path += `M${edge(y, seconds, side).toFixed(1)},${y.toFixed(1)}L${edge(next, seconds, side).toFixed(1)},${next.toFixed(1)}`;
    }
  }
  return path;
}

function backgroundLines(seconds: number) {
  'worklet';
  let path = '';
  for (let i = 0; i < 8; i++) {
    const depth = (i / 8 + seconds * SPLASH_SPEED.parallax) % 1;
    const y = depthY(depth);
    const distance = 9 + depth * 16;
    const width = 10 + 37 * depth;
    const left = edge(y, seconds, -1) - distance;
    const right = edge(y, seconds, 1) + distance;
    path += `M${(left - width).toFixed(1)},${y.toFixed(1)}h${width.toFixed(1)}M${right.toFixed(1)},${(y - 1).toFixed(1)}h${width.toFixed(1)}`;
  }
  return path;
}

export function useExplorationSplash(enabled: boolean) {
  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(() => enabled && !introPlayed);
  const time = useSharedValue(visible ? 0 : SPLASH_TIMING.end);

  const finish = useCallback(() => {
    introPlayed = true;
    setVisible(false);
  }, []);

  useEffect(() => {
    if (!enabled || !visible) return;
    time.set(withTiming(SPLASH_TIMING.end, {
      duration: reduced ? SPLASH_TIMING.reduced : SPLASH_TIMING.end,
      easing: Easing.linear,
      reduceMotion: ReduceMotion.Never,
    }, (completed) => {
      if (completed) scheduleOnRN(finish);
    }));
    return () => cancelAnimation(time);
  }, [enabled, visible, reduced, time, finish]);

  const skip = useCallback(() => {
    cancelAnimation(time);
    time.set(SPLASH_TIMING.end);
    finish();
  }, [finish, time]);

  const sheetTransition = useAnimatedStyle(() => {
    if (reduced || !visible) return { transform: [{ translateY: 0 }] };
    const reveal = easeOut(range(time.get(), SPLASH_TIMING.loginStart, SPLASH_TIMING.end));
    return { transform: [{ translateY: 64 * (1 - reveal) }] };
  }, [reduced, visible]);

  return { visible, time, skip, reduced, sheetTransition };
}

function TrailScene({ time }: { time: SharedValue<number> }) {
  const p = usePalette();
  const scene = useAnimatedStyle(() => {
    const value = time.get();
    return { opacity: easeInOut(range(value, 0, SPLASH_TIMING.arrival))
      * (1 - easeInOut(range(value, SPLASH_TIMING.journeyEnd, SPLASH_TIMING.loginStart))) };
  });
  const walker = useAnimatedStyle(() => {
    const value = time.get();
    const seconds = travelTime(value);
    const arrival = easeOut(range(value, 0, SPLASH_TIMING.arrival));
    const depart = easeInOut(range(value, SPLASH_TIMING.journeyEnd, SPLASH_TIMING.loginStart));
    const active = easeInOut(range(value, SPLASH_TIMING.arrival, SPLASH_TIMING.arrival + 210));
    const lean = -Math.atan(BEND * WAVE_LENGTH * Math.cos(seconds * SPLASH_SPEED.steering)) * 180 / Math.PI;
    const sway = Math.sin(seconds * 9) * 2;
    return {
      opacity: arrival * (1 - depart),
      transform: [{ rotateZ: `${active * (lean + sway)}deg` },
        { translateY: active * Math.sin(seconds * 14) * 1.6 }, { scale: (0.9 + arrival * 0.1) * (1 - depart * 0.18) }],
    };
  });
  const outline = useAnimatedProps(() => ({ d: roadOutline(travelTime(time.get())) }));
  const tracks = useAnimatedProps(() => ({ d: roadMarks(travelTime(time.get())) }));
  const parallax = useAnimatedProps(() => ({ d: backgroundLines(travelTime(time.get())) }));
  return <View style={splash.art} accessible={false}>
    <Animated.View style={[StyleSheet.absoluteFill, scene]} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
        <Defs>
          <LinearGradient id="trailFade" x1="0" x2="0" y1="0" y2="1">
            <Stop offset="0" stopColor={p.dark ? '#2E4339' : '#F0F2ED'} />
            <Stop offset="0.64" stopColor={p.dark ? '#425A50' : '#CCD5CE'} />
            <Stop offset="1" stopColor={p.dark ? '#243830' : '#E2E7DF'} />
          </LinearGradient>
        </Defs>
        <Circle cx="206" cy="44" r="21" fill={p.dark ? '#515D47' : '#E7D3A4'} opacity=".6" />
        <Path d="M35 75 83 48 116 67 145 42 187 72 223 54 259 73 296 56 331 76"
          stroke={p.accent} opacity=".32" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <AnimatedPath animatedProps={parallax} stroke={p.accent} opacity=".2" strokeWidth="1.6"
          strokeLinecap="round" fill="none" />
        <AnimatedPath animatedProps={outline} fill="url(#trailFade)" stroke={p.accent} strokeWidth="1.4" strokeOpacity=".32" />
        <AnimatedPath animatedProps={tracks} fill="none" stroke={p.dark ? '#9CB1A4' : '#F9FBF6'}
          strokeWidth="2.5" strokeLinecap="round" />
      </Svg>
    </Animated.View>
    <Animated.View style={[splash.walker, walker]} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 86 100">
        <Ellipse cx="41" cy="87" rx="24" ry="9" fill="#132C24" opacity=".16" />
        <G strokeLinecap="round" strokeLinejoin="round">
          <Path d="M35 64 32 81m15-17 4 17" stroke="#234237" strokeWidth="10" />
          <Path d="M32 83h-8m27 0h9" stroke="#142C24" strokeWidth="7" />
          <Path d="M32 45 20 58m28-13 15 8 7-13" stroke="#82A48C" strokeWidth="7" fill="none" />
          <Path d="M68 43 74 14q2-8 10-10" stroke="#234237" strokeWidth="2" fill="none" />
          <Path d="M84 4v14" stroke="#879F92" strokeWidth="1" fill="none" />
          <Path d="M31 39q10-5 21 0l3 26q-15 8-27 0Z" fill="#2D624D" stroke="#214939" strokeWidth="2" />
          <Path d="M33 47q9-7 17 0v17q-9 5-17 0Z" fill="#AFC8AC" stroke="#214939" strokeWidth="2" />
          <Path d="M35 58h13m-9-13v5" stroke="#597A6A" strokeWidth="2" />
          <Circle cx="41" cy="28" r="10" fill="#CEAA82" />
          <Path d="M30 28q1-14 11-14 10 0 12 14Z" fill="#E4C287" stroke="#285446" strokeWidth="2" />
          <Path d="M26 28h31" stroke="#285446" strokeWidth="3" />
        </G>
      </Svg>
    </Animated.View>
  </View>;
}

export function ExplorationSplash({ time, skip, reduced }: {
  time: SharedValue<number>; skip: () => void; reduced: boolean;
}) {
  const p = usePalette();
  const overlay = useAnimatedStyle(() => ({
    opacity: reduced ? 1 : 1 - easeInOut(range(time.get(), SPLASH_TIMING.loginStart, SPLASH_TIMING.end)),
  }), [reduced]);
  const title = useAnimatedStyle(() => {
    const reveal = reduced ? 1 : easeOut(range(time.get(), SPLASH_TIMING.nameStart, SPLASH_TIMING.nameEnd));
    return { opacity: reveal, transform: [{ scale: 0.95 + reveal * 0.05 }] };
  }, [reduced]);
  const subtitle = useAnimatedStyle(() => {
    const reveal = reduced ? 1 : easeOut(range(time.get(), SPLASH_TIMING.subtitleStart, SPLASH_TIMING.loginStart));
    return { opacity: reveal, transform: [{ translateY: (1 - reveal) * 12 }] };
  }, [reduced]);

  return <Animated.View style={[StyleSheet.absoluteFill, splash.overlay, overlay, { backgroundColor: p.dark ? p.bg : '#FFFFFF' }]}>
    <Pressable accessibilityRole="button" accessibilityLabel={t.skipIntro} onPress={skip} style={splash.touch}>
      {!reduced && <TrailScene time={time} />}
      <Animated.View style={title}>
        <EntryWordmark />
      </Animated.View>
      <Animated.View style={subtitle}>
        <Text style={[splash.subtitle, { color: p.muted }]}>{t.splashSubtitle}</Text>
      </Animated.View>
    </Pressable>
  </Animated.View>;
}

const splash = StyleSheet.create({
  overlay: { zIndex: 5 },
  touch: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: side, gap: 7 },
  art: { width: '100%', maxWidth: 360, aspectRatio: W / H },
  walker: { position: 'absolute', width: 68, height: 79, left: '50%', top: `${WALKER_Y / H * 100}%`, marginLeft: -34, marginTop: -39.5 },
  subtitle: { fontSize: 13, textAlign: 'center' },
});
