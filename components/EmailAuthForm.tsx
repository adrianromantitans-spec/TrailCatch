import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { t } from '../i18n';
import { backend, ProviderUnavailable, requestPasswordReset, setSessionPersistence, signInWithProvider } from '../services/backend';
import { brandGreen, Notice, onBrand, styles, usePalette } from './ui';
import type { IconName } from './ui';

export type AuthMode = 'signIn' | 'signUp' | 'recover';
type Action = AuthMode | 'google' | 'apple';

export function AuthInput({ icon, label, password, ...props }: TextInputProps & {
  icon: IconName; label: string; password?: boolean;
}) {
  const p = usePalette();
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);

  return <View style={[form.inputFrame, {
    backgroundColor: p.dark ? p.surface : '#F2F4F1',
    borderColor: focused ? p.accent : p.line,
  }]}>
    <Ionicons name={icon} size={20} color={p.muted} />
    <TextInput {...props} accessibilityLabel={label} placeholder={label} placeholderTextColor={p.muted}
      secureTextEntry={password && !visible}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={[form.input, { color: p.ink }]} />
    {password && <Pressable accessibilityRole="button" accessibilityLabel={visible ? t.hidePassword : t.showPassword}
      onPress={() => setVisible(!visible)} style={form.eye}>
      <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={21} color={p.muted} />
    </Pressable>}
  </View>;
}

export function AuthSubmit({ label, disabled, onPress }: { label: string; disabled?: boolean; onPress: () => void }) {
  return <Pressable cssInterop={false} accessibilityRole="button" accessibilityState={{ disabled }}
    disabled={disabled} onPress={onPress}
    style={({ pressed }) => [form.submit, { backgroundColor: disabled ? '#465F55' : pressed ? '#204B3B' : brandGreen }]}>
    {!disabled && <Svg pointerEvents="none" width="100%" height="100%" style={StyleSheet.absoluteFill}>
      <Defs><LinearGradient id="loginAccent" x1="0" x2="1" y1="0" y2="1">
        <Stop offset="0" stopColor="#2C644E" />
        <Stop offset="1" stopColor="#183F31" />
      </LinearGradient></Defs>
      <Rect width="100%" height="100%" fill="url(#loginAccent)" />
    </Svg>}
    <Text style={form.submitLabel}>{label}</Text>
  </Pressable>;
}

export function EmailAuthForm({ mode: supplied, onModeChange }: { mode?: AuthMode; onModeChange?: (mode: AuthMode) => void }) {
  const p = usePalette();
  const [localMode, setLocalMode] = useState<AuthMode>('signIn');
  const mode = supplied ?? localMode;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [pending, setPending] = useState<Action>();
  const [notice, setNotice] = useState<{ text: string; error?: boolean }>();
  const lock = useRef(false);
  const recovery = mode === 'recover';
  const signup = mode === 'signUp';

  function change(next: AuthMode) {
    if (lock.current) return;
    setNotice(undefined);
    setPassword('');
    if (onModeChange) onModeChange(next);
    else setLocalMode(next);
  }

  async function submit(action: Action) {
    if (!backend || lock.current) return;
    lock.current = true;
    setPending(action);
    setNotice(undefined);
    try {
      if (action === 'recover') {
        await requestPasswordReset(email.trim());
        setNotice({ text: t.resetSent });
        return;
      }
      setSessionPersistence(remember);
      if (action === 'google' || action === 'apple') {
        await signInWithProvider(action);
        return;
      }
      const credentials = { email: email.trim(), password };
      const { error, data } = action === 'signUp'
        ? await backend.auth.signUp(credentials)
        : await backend.auth.signInWithPassword(credentials);
      if (error) throw error;
      setPassword('');
      if (action === 'signUp' && !data.session) setNotice({ text: t.checkEmail });
    } catch (error) {
      setNotice({ text: error instanceof ProviderUnavailable ? t.providerUnavailable : t.accountError, error: true });
    } finally { lock.current = false; setPending(undefined); }
  }

  if (!backend) return <Notice message={t.backendUnavailable} />;

  const disabled = !!pending || !email.trim() || (!recovery && !password);
  return <View style={form.group}>
    <AuthInput icon="mail-outline" label={t.email} value={email} onChangeText={setEmail} keyboardType="email-address"
      autoCapitalize="none" autoComplete="email" editable={!pending}
      onSubmitEditing={recovery ? () => { if (!disabled) void submit('recover'); } : undefined} />
    {!recovery && <AuthInput icon="lock-closed-outline" label={t.password} value={password} onChangeText={setPassword}
      password autoComplete={signup ? 'new-password' : 'current-password'} editable={!pending}
      onSubmitEditing={() => { if (!disabled) void submit(mode); }} />}
    {mode === 'signIn' && <View style={form.loginOptions}>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: remember }} disabled={!!pending}
        onPress={() => setRemember((value) => !value)} style={form.remember}>
        <Ionicons name={remember ? 'checkbox' : 'square-outline'} size={19} color={p.accent} />
        <Text style={[form.optionLabel, { color: p.ink }]}>{t.rememberMe}</Text>
      </Pressable>
      <Text accessibilityRole="button" style={[form.optionLink, { color: p.accent }]}
        onPress={() => change('recover')}>{t.forgotPassword}</Text>
    </View>}
    <AuthSubmit label={pending === mode ? t.loading : recovery ? t.resetEmail : t[mode]}
      disabled={disabled} onPress={() => void submit(mode)} />
    {!recovery && <>
      <View style={form.separator}>
        <View style={[form.line, { backgroundColor: p.line }]} />
        <Text style={{ color: p.muted, fontSize: 13 }}>{t.orContinueWith}</Text>
        <View style={[form.line, { backgroundColor: p.line }]} />
      </View>
      <View style={styles.columns}>
        {(['google', 'apple'] as const).map((provider) => <Pressable key={provider} cssInterop={false}
          accessibilityRole="button" disabled={!!pending}
          style={({ pressed }) => [form.provider, { backgroundColor: pressed ? p.soft : p.dark ? p.surface : '#F2F4F1' }]}
          onPress={() => void submit(provider)}>
          <Ionicons name={provider === 'google' ? 'logo-google' : 'logo-apple'} size={19} color={p.ink} />
          <Text numberOfLines={1} style={[form.providerLabel, { color: p.ink }]}>{pending === provider ? t.loading : t[provider]}</Text>
        </Pressable>)}
      </View>
    </>}
    {!!notice && <Text accessibilityLiveRegion="polite" style={{ color: notice.error ? p.danger : p.ink }}>{notice.text}</Text>}
    <View style={form.switchMode}>
      {!recovery && <Text style={{ color: p.muted }}>{signup ? t.haveAccount : t.noAccountYet}</Text>}
      <Text accessibilityRole="button" onPress={() => change(mode === 'signIn' ? 'signUp' : 'signIn')}
        style={[form.optionLink, { color: p.accent }]}>{mode === 'signIn' ? t.registerLink : t.signIn}</Text>
    </View>
  </View>;
}

const form = StyleSheet.create({
  group: { gap: 12 },
  inputFrame: { minHeight: 54, flexDirection: 'row', alignItems: 'center', borderWidth: 1,
    borderRadius: 28, paddingLeft: 16, paddingRight: 8, gap: 10 },
  input: { flex: 1, minWidth: 0, minHeight: 52, paddingVertical: 10, fontSize: 16 },
  eye: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  loginOptions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  remember: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 44, maxWidth: '100%' },
  optionLabel: { flexShrink: 1, fontSize: 12 },
  optionLink: { fontSize: 13, fontWeight: '700', paddingVertical: 8 },
  submit: { borderRadius: 28, minHeight: 54, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', padding: 12 },
  submitLabel: { color: onBrand, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  separator: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
  provider: { flex: 1, minWidth: 0, borderRadius: 26, minHeight: 48, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 8 },
  providerLabel: { fontWeight: '700', flexShrink: 1 },
  switchMode: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', columnGap: 6 },
});
