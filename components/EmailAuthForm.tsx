import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { t } from '../i18n';
import { backend, signInWithGoogle } from '../services/backend';
import { Button, Field, Notice, styles, usePalette } from './ui';

export function EmailAuthForm({ mode = 'both' }: { mode?: 'both' | 'signIn' | 'signUp' }) {
  const p = usePalette();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState<'signIn' | 'signUp' | 'google'>();
  const [notice, setNotice] = useState<{ text: string; error?: boolean }>();
  const lock = useRef(false);

  async function submit(action: 'signIn' | 'signUp' | 'google') {
    if (!backend || lock.current) return;
    lock.current = true;
    setPending(action);
    setNotice(undefined);
    try {
      if (action === 'google') {
        await signInWithGoogle();
        return;
      }
      const credentials = { email: email.trim(), password };
      const { error, data } = action === 'signUp'
        ? await backend.auth.signUp(credentials)
        : await backend.auth.signInWithPassword(credentials);
      if (error) throw error;
      setPassword('');
      if (action === 'signUp' && !data.session) setNotice({ text: t.checkEmail });
    } catch { setNotice({ text: t.accountError, error: true }); }
    finally { lock.current = false; setPending(undefined); }
  }

  if (!backend) return <Notice message={t.backendUnavailable} />;

  const disabled = !!pending || !email.trim() || !password;
  const primary = mode === 'signUp' ? 'signUp' : 'signIn';
  return <View style={styles.group}>
    <Field label={t.email} value={email} onChangeText={setEmail} keyboardType="email-address"
      autoCapitalize="none" autoComplete="email" editable={!pending} />
    <Field label={t.password} value={password} onChangeText={setPassword} secureTextEntry
      autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'} editable={!pending}
      onSubmitEditing={() => { if (!disabled) void submit(primary); }} />
    <Button label={pending === primary ? t.loading : t[primary]} primary disabled={disabled}
      onPress={() => void submit(primary)} />
    {mode === 'both' && <Button label={pending === 'signUp' ? t.loading : t.signUp}
      disabled={disabled} onPress={() => void submit('signUp')} />}
    <Button label={pending === 'google' ? t.loading : t.signInGoogle} icon="logo-google" disabled={!!pending}
      onPress={() => void submit('google')} />
    {!!notice && <Text accessibilityLiveRegion="polite" style={{ color: notice.error ? p.danger : p.ink }}>{notice.text}</Text>}
  </View>;
}
