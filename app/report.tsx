import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Field, Header, Notice, styles, usePalette } from '../components/ui';
import { t } from '../i18n';
import { backend, useSession } from '../services/backend';

const columns = { spot: 'spot_id', photo: 'spot_photo_id', user: 'target_user_id', post: 'post_id', comment: 'comment_id' } as const;

export default function Report() {
  const router = useRouter();
  const p = usePalette();
  const params = useLocalSearchParams<{ kind?: string; id?: string }>();
  const kind = params.kind;
  const column = kind && Object.hasOwn(columns, kind) ? columns[kind as keyof typeof columns] : undefined;
  const { session } = useSession();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  async function submit() {
    if (!backend || !column || !params.id || !reason.trim() || busy) return;
    setBusy(true); setFailed(false);
    const { error } = await backend.from('reports').insert({ [column]: params.id, reason: reason.trim() });
    setBusy(false);
    if (error) setFailed(true); else router.back();
  }
  return <>
    <Header title={t.report} back={() => router.back()} />
    {!backend ? <Notice message={t.backendUnavailable} /> : !session ? <View style={styles.content}>
      <Notice message={t.signInRequired} /><Button label={t.signIn} onPress={() => router.push('/account')} />
    </View> : !column || !params.id ? <Notice message={t.noResults} /> : <View style={styles.content}>
      <Field label={t.reportReason} value={reason} onChangeText={setReason} maxLength={1000} multiline />
      {failed && <Text accessibilityLiveRegion="polite" style={{ color: p.danger }}>{t.actionError}</Text>}
      <Button label={busy ? t.loading : t.send} primary disabled={busy || !reason.trim()} onPress={() => void submit()} />
    </View>}
  </>;
}
