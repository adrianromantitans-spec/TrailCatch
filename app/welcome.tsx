import { Redirect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmailAuthForm } from '../components/EmailAuthForm';
import type { AuthMode } from '../components/EmailAuthForm';
import { EntryIllustration } from '../components/EntryIllustration';
import { side, usePalette } from '../components/ui';
import { t } from '../i18n';
import { backend, useSession } from '../services/backend';

const reveal = FadeIn.duration(380).easing(Easing.out(Easing.cubic)).reduceMotion(ReduceMotion.System);
const dismiss = FadeOut.duration(340).easing(Easing.inOut(Easing.cubic)).reduceMotion(ReduceMotion.System);
let introPlayed = false;

export default function Welcome() {
  const p = usePalette();
  const inset = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { session, guest, continueAsGuest } = useSession();
  const [showSplash, setShowSplash] = useState(() => !introPlayed);
  const [mode, setMode] = useState<AuthMode>('signIn');

  useEffect(() => {
    if (!showSplash) return;
    const timer = setTimeout(() => {
      introPlayed = true;
      setShowSplash(false);
    }, 1700);
    return () => clearTimeout(timer);
  }, [showSplash]);

  if (session || guest || !backend) return <Redirect href="/" />;

  return <View style={[layout.screen, { backgroundColor: p.bg }]}>
    <StatusBar style={p.dark ? 'light' : 'dark'} />
    <KeyboardAvoidingView behavior="padding" style={layout.screen}>
      <ScrollView keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="never"
        accessibilityElementsHidden={showSplash} importantForAccessibility={showSplash ? 'no-hide-descendants' : 'auto'}
        scrollEnabled={!showSplash} contentContainerStyle={layout.scroll} showsVerticalScrollIndicator={false}>
        <View style={{ height: Math.max(184, Math.min(height * 0.38, 340)), backgroundColor: p.dark ? '#263B30' : '#F3EADB' }}>
          <EntryIllustration dark={p.dark} />
        </View>
        <View style={[layout.sheet, {
          backgroundColor: p.dark ? p.bg : p.surface, paddingBottom: Math.max(side, inset.bottom) + 8,
        }]}>
          <View style={layout.form}>
            <Text accessibilityRole="header" style={[layout.title, { color: p.ink }]}>
              {mode === 'signIn' ? t.welcomeBack : mode === 'signUp' ? t.signUp : t.resetPassword}
            </Text>
            <EmailAuthForm mode={mode} onModeChange={setMode} />
            <Pressable accessibilityRole="button" onPress={continueAsGuest} style={layout.guest}>
              <Text style={[layout.guestLabel, { color: p.accent }]}>{t.continueAsGuest} →</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
    {showSplash && <Animated.View entering={reveal} exiting={dismiss}
      style={[StyleSheet.absoluteFill, layout.splash, { backgroundColor: p.dark ? p.bg : '#FFFFFF' }]}>
      <View style={layout.splashArt}><EntryIllustration splash dark={p.dark} /></View>
      <Text accessibilityRole="header" accessibilityLabel={t.app} style={[layout.brand, { color: p.ink }]}>
        {t.brandTrail}<Text style={{ color: p.accent }}>{t.brandCatch}</Text>
      </Text>
      <Text style={[layout.subtitle, { color: p.muted }]}>{t.splashSubtitle}</Text>
    </Animated.View>}
  </View>;
}

const layout = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flexGrow: 1 },
  sheet: { flexGrow: 1, marginTop: -29, borderTopLeftRadius: 32, borderTopRightRadius: 32,
    paddingTop: 24, paddingHorizontal: side },
  form: { width: '100%', maxWidth: 440, alignSelf: 'center', gap: 14 },
  title: { fontSize: 29, fontWeight: '800', letterSpacing: -0.7 },
  guest: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
  guestLabel: { fontSize: 14, fontWeight: '700' },
  splash: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: side, gap: 7, zIndex: 5 },
  splashArt: { width: '100%', maxWidth: 340, aspectRatio: 400 / 268 },
  brand: { fontSize: 44, fontWeight: '800', letterSpacing: -1.7 },
  subtitle: { fontSize: 13, textAlign: 'center' },
});
