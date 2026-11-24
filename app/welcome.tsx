import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Keyboard, KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, LinearTransition, ReduceMotion, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { EmailAuthForm } from '../components/EmailAuthForm';
import { Button, IconButton, onBrand, side, usePalette } from '../components/ui';
import { t } from '../i18n';
import { useSession } from '../services/backend';

type Mode = 'start' | 'signIn' | 'signUp';

const opening = FadeInDown.duration(540).springify().damping(24).reduceMotion(ReduceMotion.System);
const switchForm = FadeInDown.duration(260).easing(Easing.out(Easing.cubic)).reduceMotion(ReduceMotion.System);
const resize = LinearTransition.duration(360).easing(Easing.out(Easing.cubic)).reduceMotion(ReduceMotion.System);
const fade = FadeIn.duration(420).reduceMotion(ReduceMotion.System);
const landscapeOpening = ZoomIn.duration(850).reduceMotion(ReduceMotion.System);

export default function Welcome() {
  const p = usePalette();
  const inset = useSafeAreaInsets();
  const { continueAsGuest } = useSession();
  const [mode, setMode] = useState<Mode>('start');
  const form = mode !== 'start';

  function change(next: Mode) {
    Keyboard.dismiss();
    setMode(next);
  }

  return (
    <KeyboardAvoidingView behavior="padding" style={styles.screen}>
      <StatusBar style="light" />
      <Animated.View entering={landscapeOpening} pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Image source={require('../assets/lake.jpg')} style={StyleSheet.absoluteFill} contentFit="cover"
          contentPosition="center" />
      </Animated.View>
      <Svg pointerEvents="none" width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="landscapeShade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#0B2119" stopOpacity={0.36} />
            <Stop offset="0.58" stopColor="#0B2119" stopOpacity={0.08} />
            <Stop offset="1" stopColor="#0B2119" stopOpacity={0.9} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#landscapeShade)" />
      </Svg>
      <ScrollView keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="never"
        contentContainerStyle={[styles.scroll, { paddingTop: inset.top }]} showsVerticalScrollIndicator={false}>
        <Animated.View layout={resize} style={[styles.hero, form && styles.heroCompact]}>
          {!form && <Animated.View entering={fade} style={styles.identity}>
            <Image source={require('../assets/icon.png')} style={styles.logo} />
            <Text accessibilityRole="header" style={styles.brand}>{t.app}</Text>
          </Animated.View>}
        </Animated.View>
        <Animated.View entering={opening} layout={resize} style={[styles.panel, {
          backgroundColor: p.bg, paddingBottom: Math.max(inset.bottom, side),
        }]}>
          {!form ? <Animated.View entering={switchForm} style={styles.actions}>
            <Button label={t.signIn} primary onPress={() => change('signIn')} />
            <Button label={t.signUp} onPress={() => change('signUp')} />
            <Button label={t.continueAsGuest} onPress={continueAsGuest} />
          </Animated.View> : <Animated.View key={mode} entering={switchForm} style={styles.actions}>
            <View style={styles.formHeading}>
              <IconButton name="chevron-back" label={t.back} align="start" onPress={() => change('start')} />
              <Text accessibilityRole="header" style={[styles.heading, { color: p.ink }]}>{t[mode]}</Text>
            </View>
            <EmailAuthForm mode={mode} />
            <Button label={mode === 'signIn' ? t.signUp : t.signIn} onPress={() => change(mode === 'signIn' ? 'signUp' : 'signIn')} />
          </Animated.View>}
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#132A22' },
  scroll: { flexGrow: 1 },
  hero: { flexGrow: 1, minHeight: 280, justifyContent: 'flex-end', padding: side + 4 },
  heroCompact: { minHeight: 48, flexGrow: 1 },
  identity: { alignItems: 'flex-start', gap: 12, paddingBottom: 12 },
  logo: { width: 56, height: 56, borderRadius: 14 },
  brand: { fontSize: 44, fontWeight: '800', color: onBrand, letterSpacing: -1.8 },
  panel: { paddingHorizontal: side, paddingTop: 24, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  actions: { gap: 12 },
  formHeading: { flexDirection: 'row', alignItems: 'center' },
  heading: { flex: 1, fontSize: 25, fontWeight: '800' },
});
