import { Ionicons } from '@expo/vector-icons';
import { Directory, File, Paths } from 'expo-file-system';
import { Image } from 'expo-image';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import { isAvailableAsync, shareAsync } from 'expo-sharing';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, BackHandler, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { TabContent, useTabClearance } from '../../components/GlassTabBar';
import { Avatar, Button, Header, IconButton, IconName, Notice, side, styles, usePalette } from '../../components/ui';
import { allOutings, deleteOutings } from '../../db/diary';
import { PAGE_SIZE, photoList } from '../../db/model';
import { useDiary } from '../../db/useDiary';
import { t } from '../../i18n';
import { useSession } from '../../services/backend';
import { exportPhotos, photoSource, removeAllPhotos } from '../../services/photos';

const gridGap = 8;
const exportsDirectory = new Directory(Paths.cache, 'trailcatch-exports');

export default function Profile() {
  const router = useRouter();
  const { session } = useSession();
  const p = usePalette();
  const tabClearance = useTabClearance();
  const db = useSQLiteContext();
  const { items, error, load } = useDiary();
  const [busy, setBusy] = useState(false);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [gridWidth, setGridWidth] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  useFocusEffect(useCallback(() => () => setMenuOpen(false), []));
  useFocusEffect(useCallback(() => {
    if (!menuOpen) return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      setMenuOpen(false);
      return true;
    });
    return () => listener.remove();
  }, [menuOpen]));

  const photos = (items ?? []).flatMap((item) => photoList(item).map((photo, index) => ({ id: item.id, title: item.title, photo, index })));

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

  function menuItem(label: string, icon: IconName, onPress: () => void, danger = false, disabled = false) {
    const color = disabled ? p.muted : danger ? p.danger : p.ink;
    return (
      <Pressable cssInterop={false} accessibilityRole="menuitem" accessibilityState={{ disabled }} disabled={disabled}
        onPress={() => { setMenuOpen(false); onPress(); }}
        style={({ pressed }) => [profileStyles.menuItem, {
          backgroundColor: pressed ? p.soft : p.surface,
        }]}>
        <Ionicons name={icon} size={20} color={color} />
        <Text style={[profileStyles.itemLabel, { color }]}>{label}</Text>
      </Pressable>
    );
  }

  const counts = [
    [t.outings, items?.length ?? 0],
    [t.catches, items?.reduce((total, item) => total + item.catches.length, 0) ?? 0],
    [t.followers, 0], [t.following, 0],
  ];
  const tile = Math.max(0, (gridWidth - side * 2 - gridGap * 2) / 3);
  return <TabContent name="profile">
    <Header title={t.profile}>
      <IconButton name="menu-outline" label={t.profileMenu} align="end" expanded={menuOpen}
        onPress={() => setMenuOpen((open) => !open)} />
    </Header>
    <View style={styles.screen}>
      {menuOpen && <View accessibilityRole="menu" accessibilityViewIsModal onAccessibilityEscape={() => setMenuOpen(false)}
        style={[profileStyles.menu, { backgroundColor: p.surface, borderColor: p.line }]}>
        {menuItem(t.deleteSamples, 'trash-outline', () => confirm(true), false, busy || !items?.some((item) => item.sample))}
        {menuItem(t.deleteAll, 'alert-circle-outline', () => confirm(false), true, busy)}
        <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: p.line }} />
        {session && menuItem(t.saved, 'bookmark-outline', () => router.push('/saved'))}
        {menuItem(t.account, 'person-circle-outline', () => router.push('/account'))}
        {menuItem(t.privacy, 'shield-checkmark-outline', () => router.push('/privacy'))}
        {menuItem(t.terms, 'document-text-outline', () => router.push('/terms'))}
      </View>}
      <FlatList data={photos.slice(0, limit)} numColumns={3} keyExtractor={({ id, index }) => `${id}-${index}`}
        onEndReached={() => { if (limit < photos.length) setLimit(limit + PAGE_SIZE); }}
        accessibilityElementsHidden={menuOpen} importantForAccessibility={menuOpen ? 'no-hide-descendants' : 'auto'}
        style={styles.screen} contentInsetAdjustmentBehavior="never"
        onLayout={({ nativeEvent }) => setGridWidth(nativeEvent.layout.width)}
        contentContainerStyle={{ paddingHorizontal: side, paddingBottom: tabClearance }}
        columnWrapperStyle={{ gap: gridGap, marginBottom: gridGap }}
        ListHeaderComponent={<View style={profileStyles.summary}>
          <View style={profileStyles.identity}>
            <Avatar size={64} />
            <Text style={[styles.section, { color: p.ink, flexShrink: 1 }]}>{t.personal}</Text>
          </View>
          <View style={profileStyles.counts}>
            {counts.map(([label, count]) => <View key={label} style={profileStyles.stat}>
              <Text style={[profileStyles.count, { color: p.ink }]}>{count}</Text>
              <Text style={[profileStyles.statLabel, { color: p.muted }]}>{label}</Text>
            </View>)}
          </View>
          {session && <View style={styles.columns}>
            <Button stretch label={t.posts} onPress={() => router.push({ pathname: '/user/[id]', params: { id: session.user.id } })} />
            <Button stretch label={t.saved} icon="bookmark-outline" onPress={() => router.push('/saved')} />
          </View>}
          <View style={profileStyles.actions}>
            <Pressable cssInterop={false} accessibilityRole="button" onPress={() => router.push('/stats')}
              style={({ pressed }) => [profileStyles.annual, { backgroundColor: pressed ? p.soft : 'transparent' }]}>
              <Text style={[profileStyles.annualTitle, { color: p.ink }]}>{t.annual}</Text>
              <Ionicons name="chevron-forward" size={16} color={p.muted} />
            </Pressable>
            <View style={profileStyles.export}>
              <Button label={t.export} icon="download-outline" singleLine disabled={busy} onPress={() => void exportData()} />
            </View>
          </View>
        </View>}
        ListEmptyComponent={error ? <Notice message={t.loadError} retry={() => void load()} /> :
          !items ? <Notice message={t.loading} loading /> : !items.length ? <Notice message={t.empty} /> : undefined}
        renderItem={({ item }) => <Link href={{ pathname: '/outing/[id]', params: { id: item.id } }} asChild>
          <Pressable accessibilityLabel={item.title}>
            <Image source={photoSource(item.photo)} style={{ width: tile, height: tile, borderRadius: 10, backgroundColor: p.soft }} transition={140} />
          </Pressable>
        </Link>} />
      {menuOpen && <Pressable accessibilityRole="button" accessibilityLabel={t.closeMenu}
        onPress={() => setMenuOpen(false)} style={profileStyles.scrim} />}
    </View>
  </TabContent>;
}


const profileStyles = StyleSheet.create({
  summary: { paddingVertical: 20, gap: 20 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  counts: { flexDirection: 'row', gap: 4 },
  stat: { flex: 1, minWidth: 0, alignItems: 'center', gap: 4 },
  count: { fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 12, textAlign: 'center', width: '100%' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  annual: { flex: 1, minHeight: 44, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 },
  annualTitle: { flexShrink: 1, fontSize: 16, fontWeight: '700' },
  export: { maxWidth: '53%' },
  scrim: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: '#10191470', zIndex: 1 },
  menu: { alignSelf: 'flex-end', width: 240, marginTop: 4, marginRight: side, marginBottom: 4,
    borderWidth: 1, borderRadius: 16, zIndex: 2,
    elevation: 6, shadowColor: '#12251B', shadowOpacity: 0.16, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  menuItem: { minHeight: 48, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  itemLabel: { flex: 1, fontSize: 14, fontWeight: '600' },
});
