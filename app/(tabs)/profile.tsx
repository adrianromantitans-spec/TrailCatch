import { Directory, File, Paths } from 'expo-file-system';
import { Image } from 'expo-image';
import { Link, useRouter } from 'expo-router';
import { isAvailableAsync, shareAsync } from 'expo-sharing';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, FlatList, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabContent } from '../../components/GlassTabBar';
import { Avatar, bottomSpace, Button, Header, Notice, side, styles, usePalette } from '../../components/ui';
import { allOutings, deleteOutings } from '../../db/diary';
import { PAGE_SIZE, photoList } from '../../db/model';
import { useDiary } from '../../db/useDiary';
import { t } from '../../i18n';
import { exportPhotos, photoSource, removeAllPhotos } from '../../services/photos';

const exportsDirectory = new Directory(Paths.cache, 'trailcatch-exports');

export default function Profile() {
  const router = useRouter();
  const p = usePalette();
  const inset = useSafeAreaInsets();
  const db = useSQLiteContext();
  const { items, error, load } = useDiary();
  const [busy, setBusy] = useState(false);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const { width } = useWindowDimensions();
  const photos = (items ?? []).flatMap((item) => photoList(item).map((photo, index) => ({ id: item.id, photo, index })));

  async function exportData() {
    if (busy) return;
    setBusy(true);
    const file = new File(exportsDirectory, `trailcatch-${Date.now()}.json`);
    try {
      if (!(await isAvailableAsync())) throw new Error(t.exportError);
      const outings = (await allOutings(db)).filter((item) => !item.sample);
      const attachments = await exportPhotos(outings.flatMap(photoList));
      exportsDirectory.create({ idempotent: true, intermediates: true });
      file.create();
      file.write(JSON.stringify({ version: 1, outings, attachments }, null, 2));
      await shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle: t.export });
    } catch { Alert.alert(t.exportError); }
    finally { setBusy(false); }
  }

  function confirm(samples: boolean) {
    Alert.alert(samples ? t.deleteSamplesPrompt : t.deleteAllPrompt, undefined, [
      { text: t.cancel, style: 'cancel' },
      { text: t.delete, style: 'destructive', onPress: async () => {
        setBusy(true);
        try {
          await deleteOutings(db, samples);
          if (!samples) {
            removeAllPhotos();
            if (exportsDirectory.exists) exportsDirectory.delete();
          }
        } catch { Alert.alert(t.deleteError); }
        finally { await load(); setBusy(false); }
      } },
    ]);
  }

  const counts = [
    [t.outings, items?.length ?? 0],
    [t.catches, items?.reduce((total, item) => total + item.catches.length, 0) ?? 0],
    [t.followers, 0], [t.following, 0],
  ];
  const tile = Math.floor((width - 4) / 3);
  return <TabContent name="profile">
    <Header title={t.profile} />
    <FlatList data={photos.slice(0, limit)} numColumns={3} keyExtractor={({ id, index }) => `${id}-${index}`}
      onEndReached={() => { if (limit < photos.length) setLimit(limit + PAGE_SIZE); }}
      contentContainerStyle={{ paddingBottom: bottomSpace + inset.bottom }}
      columnWrapperStyle={{ gap: 2, marginBottom: 2 }}
      ListHeaderComponent={<View style={{ padding: side, gap: 15 }}>
        <View style={styles.row}>
          <Avatar size={66} />
          <Text style={[styles.section, { color: p.ink, marginLeft: 5 }]}>{t.personal}</Text>
        </View>
        <View style={[styles.row, { alignItems: 'flex-start', justifyContent: 'space-between' }]}>
          {counts.map(([label, count]) => <View key={label} style={{ alignItems: 'center', gap: 4 }}>
            <Text style={{ color: p.ink, fontSize: 18, fontWeight: '800' }}>{count}</Text>
            <Text style={{ color: p.muted, fontSize: 12 }}>{label}</Text>
          </View>)}
        </View>
        <Button label={t.annual} icon="stats-chart-outline" onPress={() => router.push('/stats')} />
        <View style={styles.row}>
          <Button label={t.export} icon="download-outline" disabled={busy} onPress={() => void exportData()} />
          {items?.some((item) => item.sample) && <Button label={t.deleteSamples} danger disabled={busy} onPress={() => confirm(true)} />}
          <Button label={t.deleteAll} danger disabled={busy} onPress={() => confirm(false)} />
        </View>
        <View style={styles.row}>
          <Button label={t.privacy} onPress={() => router.push('/privacy')} />
          <Button label={t.terms} onPress={() => router.push('/terms')} />
        </View>
      </View>}
      ListEmptyComponent={error ? <Notice message={t.loadError} retry={() => void load()} /> :
        !items ? <Notice message={t.loading} loading /> : !items.length ? <Notice message={t.empty} /> : undefined}
      renderItem={({ item }) => <Link href={{ pathname: '/outing/[id]', params: { id: item.id } }} asChild>
        <Pressable accessibilityLabel={t.outings}>
          <Image source={photoSource(item.photo)} style={{ width: tile, height: tile, backgroundColor: p.soft }} transition={140} />
        </Pressable>
      </Link>} />
  </TabContent>;
}
