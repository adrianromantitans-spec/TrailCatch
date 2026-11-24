import { Redirect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmailAuthForm } from '../components/EmailAuthForm';
import type { AuthMode } from '../components/EmailAuthForm';
import { EntryIllustration } from '../components/EntryIllustration';
import { ExplorationSplash, useExplorationSplash } from '../components/ExplorationSplash';
import { side, usePalette } from '../components/ui';
import { t } from '../i18n';
import { backend, useSession } from '../services/backend';

export default function Welcome() {
  const p = usePalette();
  const inset = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { session, guest, continueAsGuest } = useSession();
  const { visible: showSplash, time, skip, reduced, sheetTransition } = useExplorationSplash(!!backend && !session && !guest);
  const [mode, setMode] = useState<AuthMode>('signIn');

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
        <Animated.View style={[layout.sheet, sheetTransition, {
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
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
    {showSplash && <ExplorationSplash time={time} skip={skip} reduced={reduced} />}
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
});
