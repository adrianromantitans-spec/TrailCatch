import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { Header, Notice, styles, usePalette } from '../components/ui';
import { relativeDate, t } from '../i18n';
import { backend, useSession } from '../services/backend';

type Report = { id: string; reason: string; created_at: string };

export default function Reports() {
  const router = useRouter();
  const p = usePalette();
  const { session } = useSession();
  const admin = session?.user.app_metadata.role === 'admin';
  const [reports, setReports] = useState<Report[]>();
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(() => new AbortController());
  useFocusEffect(useCallback(() => {
    let active = true;
    if (backend && admin) {
      setFailed(false);
      void backend.from('reports').select('id,reason,created_at').order('created_at', { ascending: false }).limit(100).abortSignal(revision.signal)
        .then(({ data, error }) => {
          if (!active) return;
          setReports(data ?? []);
          setFailed(!!error);
        });
    }
    return () => { active = false; };
  }, [admin, revision]));
  return <>
    <Header title={t.reports} back={() => router.back()} />
    {!admin ? <Notice message={t.noResults} /> : failed ? <Notice message={t.loadError} retry={() => { revision.abort(); setRevision(new AbortController()); }} /> :
      <FlatList data={reports ?? []} keyExtractor={(item) => item.id} contentContainerStyle={styles.content}
        ListEmptyComponent={<Notice loading={!reports} message={reports ? t.noReports : t.loading} />}
        renderItem={({ item }) => <View style={styles.group}>
          <Text style={{ color: p.ink }}>{item.reason}</Text>
          <Text style={{ color: p.muted }}>{relativeDate(item.created_at.slice(0, 10))}</Text>
        </View>} />}
  </>;
}
