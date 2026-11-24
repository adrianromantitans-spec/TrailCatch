import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthInput, AuthSubmit } from '../components/EmailAuthForm';
import { Button, Header, Notice, side, styles, usePalette } from '../components/ui';
import { t } from '../i18n';
import { backend } from '../services/backend';

export default function ResetPassword() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code?: string }>();
  const p = usePalette();
  const inset = useSafeAreaInsets();
  const exchange = useRef<{ code: string; result: Promise<boolean> } | null>(null);
  const [checked, setChecked] = useState<{ code: string; valid: boolean }>();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!backend || !code) return;
    let active = true;
    if (exchange.current?.code !== code) {
      const result = backend.auth.exchangeCodeForSession(code).then(({ data, error: failure }) =>
        !failure && !!data.session && 'redirectType' in data && data.redirectType === 'recovery')
        .catch(() => false);
      exchange.current = { code, result };
    }
    void exchange.current.result.then((valid) => { if (active) setChecked({ code, valid }); });
    return () => { active = false; };
  }, [code]);

  async function update() {
    if (!backend || busy || !checked?.valid || checked.code !== code || !password) return;
    setBusy(true);
    setError(false);
    try {
      const result = await backend.auth.updateUser({ password });
      if (result.error) throw result.error;
      router.replace('/');
    } catch { setError(true); }
    finally { setBusy(false); }
  }

  return <>
    <Header title={t.resetPassword} back={() => router.replace('/')} />
    {!backend || !code || (checked?.code === code && !checked.valid) ? <>
      <Notice message={t.invalidResetLink} />
      <Button label={t.back} onPress={() => router.replace('/')} />
    </> : checked?.code !== code ? <Notice message={t.loading} loading /> :
      <ScrollView style={styles.screen} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets
        contentContainerStyle={[styles.content, { paddingBottom: inset.bottom + side }]}>
        <AuthInput label={t.newPassword} icon="lock-closed-outline" value={password}
          onChangeText={setPassword} autoComplete="new-password" password editable={!busy} />
        <AuthSubmit label={busy ? t.loading : t.updatePassword} disabled={busy || !password}
          onPress={() => void update()} />
        {error && <Text accessibilityLiveRegion="polite" style={{ color: p.danger }}>{t.accountError}</Text>}
      </ScrollView>}
  </>;
}
