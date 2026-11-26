import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import type { ReactElement } from 'react';
import { FlatList, Pressable, Text } from 'react-native';
import { t } from '../i18n';
import { searchProfiles } from '../services/social';
import type { Profile } from '../services/social';
import { Avatar, Notice, side, styles, usePalette } from './ui';

export function PeopleResults({ query, bottom, emptyState, loadingState }: {
  query: string; bottom: number; emptyState?: ReactElement; loadingState?: ReactElement;
}) {
  const router = useRouter();
  const p = usePalette();
  const [result, setResult] = useState<{ query: string; revision: number; profiles?: Profile[] }>();
  const [retry, setRetry] = useState(0);

  useFocusEffect(useCallback(() => {
    const request = new AbortController();
    const timer = setTimeout(() => {
      void searchProfiles(query, request.signal).then((profiles) => {
        if (!request.signal.aborted) setResult({ query, revision: retry, profiles });
      }).catch(() => { if (!request.signal.aborted) setResult({ query, revision: retry }); });
    }, 220);
    return () => { clearTimeout(timer); request.abort(); };
  }, [query, retry]));

  const current = result?.query === query && result.revision === retry ? result : undefined;
  return <FlatList data={current?.profiles ?? []} keyExtractor={(item) => item.id}
    style={styles.screen} contentContainerStyle={[styles.content, { paddingBottom: bottom }]}
    contentInsetAdjustmentBehavior="never" keyboardShouldPersistTaps="handled"
    ListEmptyComponent={current && !current.profiles ? <Notice message={t.loadError} retry={() => {
      setResult(undefined); setRetry((value) => value + 1);
    }} /> : (current ? emptyState : loadingState) ?? <Notice message={current ? t.noPeopleFound : t.loading} loading={!current} />}
    renderItem={({ item }) => <Pressable style={[styles.row, { minHeight: 44, paddingHorizontal: side / 2 }]}
      accessibilityRole="button" onPress={() => router.push({ pathname: '/user/[id]', params: { id: item.id } })}>
      {item.avatar_url ? <Image source={item.avatar_url} style={{ width: 38, height: 38, borderRadius: 19 }} /> : <Avatar />}
      <Text numberOfLines={2} style={{ color: p.ink, fontWeight: '700', flexShrink: 1 }}>{item.display_name}</Text>
    </Pressable>} />;
}
