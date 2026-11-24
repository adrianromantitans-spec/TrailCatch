import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmailAuthForm } from '../components/EmailAuthForm';
import { Button, Field, Header, Notice, side, styles, usePalette } from '../components/ui';
import { t } from '../i18n';
import { unregisterPush } from '../services/push';
import { backend, useSession } from '../services/backend';

export default function Account() {
  const router = useRouter();
  const p = usePalette();
  const inset = useSafeAreaInsets();
  const { session, loading, resetGuest } = useSession();
  const userId = session?.user.id;
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState('');
  const [loadedUser, setLoadedUser] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!backend || !userId) return;
    let alive = true;
    void backend.from('profiles').select('display_name,bio,avatar_url').eq('id', userId).single()
      .then(({ data, error }) => {
        if (!alive) return;
        if (error || !data) { setMessage(t.loadError); setFailed(true); return; }
        setName(data.display_name); setBio(data.bio); setAvatar(data.avatar_url ?? ''); setLoadedUser(userId); setFailed(false);
      });
    return () => { alive = false; };
  }, [userId, retry]);

  async function perform(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setMessage(''); setFailed(false);
    try { await action(); } catch { setFailed(true); setMessage(t.accountError); }
    finally { setBusy(false); }
  }

  function removeAccount() {
    Alert.alert(t.removeAccountPrompt, undefined, [
      { text: t.cancel, style: 'cancel' },
      { text: t.removeAccount, style: 'destructive', onPress: () => void perform(async () => {
        if (!backend) return;
        const { error } = await backend.functions.invoke('delete-account', { method: 'POST' });
        if (error) throw error;
        await backend.auth.signOut({ scope: 'local' });
        resetGuest();
        router.replace('/welcome');
      }) },
    ]);
  }

  const client = backend;
  return <>
    <Header title={t.account} back={() => router.canGoBack() ? router.back() : router.replace('/')} />
    {!client ? <Notice message={t.backendUnavailable} /> : loading ? <Notice message={t.loading} loading /> :
      <ScrollView style={styles.screen} keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: inset.bottom + side }]}>
        {session ? <>
          {loadedUser === userId ? <>
            <Field label={t.displayName} value={name} onChangeText={setName} maxLength={80} />
            <Field label={t.bio} value={bio} onChangeText={setBio} maxLength={500} multiline />
            <Field label={t.avatarUrl} value={avatar} onChangeText={setAvatar} keyboardType="url" autoCapitalize="none" />
            <Button label={t.saveProfile} primary disabled={busy || !name.trim()} onPress={() => void perform(async () => {
              const result = await client.from('profiles').update({
                display_name: name.trim(), bio, avatar_url: avatar.trim() || null,
              }).eq('id', session.user.id);
              if (result.error) throw result.error;
              setMessage(t.accountSaved);
            })} />
          </> : failed ? <Notice message={t.loadError} retry={() => { setFailed(false); setMessage(''); setRetry((value) => value + 1); }} />
            : <Notice message={t.loading} loading />}
          {session.user.app_metadata.role === 'admin' &&
            <Button label={t.reports} onPress={() => router.push('/reports')} />}
          <Button label={t.signOut} disabled={busy} onPress={() => void perform(async () => {
            await unregisterPush();
            const result = await client.auth.signOut();
            if (result.error) throw result.error;
            resetGuest();
            router.replace('/welcome');
          })} />
          <Button label={t.removeAccount} danger disabled={busy} onPress={removeAccount} />
        </> : <EmailAuthForm />}
        {!!message && <Text accessibilityLiveRegion="polite" style={{ color: failed ? p.danger : p.ink }}>{message}</Text>}
      </ScrollView>}
  </>;
}
