import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { Avatar, Field, Header, Notice, styles, usePalette } from '../components/ui';
import { t } from '../i18n';
import { backend } from '../services/backend';
import type { Profile } from '../services/social';

export default function People() {
  const router = useRouter();
  const p = usePalette();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>();
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(() => new AbortController());
  useFocusEffect(useCallback(() => {
    const client = backend;
    if (!client) return;
    let active = true;
    setFailed(false);
    setResults(undefined);
    const timer = setTimeout(() => {
      void client.from('profiles').select('id,display_name,avatar_url').ilike('display_name', `%${query.trim().replace(/[%_]/g, '')}%`)
        .order('display_name').limit(20).abortSignal(revision.signal).then(({ data, error }) => {
          if (active) { setFailed(!!error); setResults(data ?? []); }
        });
    }, 220);
    return () => { active = false; clearTimeout(timer); };
  }, [query, revision]));

  return <>
    <Header title={t.users} back={() => router.back()} />
    {!backend ? <Notice message={t.backendUnavailable} /> : <>
      <View style={styles.content}><Field label={t.searchUsers} value={query} onChangeText={setQuery} returnKeyType="search" /></View>
      <FlatList data={results ?? []} keyExtractor={(item) => item.id} contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={failed ? <Notice message={t.loadError} retry={() => { revision.abort(); setRevision(new AbortController()); }} />
          : <Notice message={results ? t.noResults : t.loading} loading={!results} />}
        renderItem={({ item }) => <Pressable style={styles.row} accessibilityRole="button"
          onPress={() => router.push({ pathname: '/user/[id]', params: { id: item.id } })}>
          {item.avatar_url ? <Image source={item.avatar_url} style={{ width: 38, height: 38, borderRadius: 19 }} /> : <Avatar />}
          <Text style={{ color: p.ink, fontWeight: '700', flexShrink: 1 }}>{item.display_name}</Text>
        </Pressable>} />
    </>}
  </>;
}
