import { Ionicons } from '@expo/vector-icons';
import { Directory, File, Paths } from 'expo-file-system';
import { Image } from 'expo-image';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import { isAvailableAsync, shareAsync } from 'expo-sharing';
import { useSQLiteContext } from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import Storage from 'expo-sqlite/kv-store';
import { useCallback, useMemo, useState } from 'react';
import { Alert, BackHandler, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { TabContent, useTabClearance } from '../../components/GlassTabBar';
import { Avatar, Button, Field, Header, IconButton, IconName, Notice, side, styles, usePalette } from '../../components/ui';
import { allOutings, deleteOutings } from '../../db/diary';
import { PAGE_SIZE, photoList } from '../../db/model';
import type { Outing, OutingType, Photo } from '../../db/model';
import { useDiary } from '../../db/useDiary';
import { locale, t } from '../../i18n';
import { backend, useSession } from '../../services/backend';
import { exportPhotos, photoSource, removeAllPhotos } from '../../services/photos';
import { annualStats } from '../../services/stats';

const gridGap = 8;
const exportsDirectory = new Directory(Paths.cache, 'trailcatch-exports');
const identityKey = 'trailcatch-diary-profile';
const gridTabs = ['outings', 'catches', 'saved'] as const;
type GridTab = typeof gridTabs[number];
type Identity = { display_name: string; bio: string; avatar_url: string | null };
type GridTile = { key: string; id: string; title: string; date: string; type: OutingType; photo?: Photo };
const defaultIdentity: Identity = { display_name: t.personal, bio: '', avatar_url: null };
const noOutings: Outing[] = [];
const dateFormatter = new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'UTC' });
const numberFormatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });

function formatDate(date: string) {
  const value = Date.parse(date);
  return Number.isFinite(value) ? dateFormatter.format(value) : '—';
}

function makeTiles(outings: Outing[], tab: GridTab): GridTile[] {
  return outings.flatMap((entry) => {
    const { id, title, date, type } = entry;
    if (tab === 'saved' && !entry.saved) return [];
    const photos = tab === 'catches' ? entry.catches.flatMap(({ photo }) => photo ? [photo] : [])
      : tab === 'saved' ? photoList(entry) : entry.photos;
    return photos.length ? photos.map((photo, index) => ({ key: `${id}-${index}`, id, title, date, type, photo }))
      : tab === 'catches' ? [] : [{ key: id, id, title, date, type }];
  });
}

function largestCatch(outings: Outing[]) {
  let length = 0;
  let weight = 0;
  for (const outing of outings) for (const item of outing.catches) {
    if (Number.isFinite(item.size)) length = Math.max(length, item.size ?? 0);
    if (Number.isFinite(item.weight)) weight = Math.max(weight, item.weight ?? 0);
  }
  if (length) return `${numberFormatter.format(length)} ${t.units.cm}`;
  return weight ? `${numberFormatter.format(weight)} ${t.units.kg}` : '—';
}

function profileHandle(preferred: unknown, name: string) {
  const username = typeof preferred === 'string' ? preferred.replace(/^@/, '') : '';
  const handle = (username && !username.includes('@') ? username : name).trim().toLowerCase()
    .replace(/[^\p{L}\p{N}_.]+/gu, '.').replace(/^\.+|\.+$/g, '');
  return `@${handle.slice(0, 32) || t.diaryHandle}`;
}

async function shareDiary(db: SQLiteDatabase) {
  if (!(await isAvailableAsync())) throw new Error(t.exportError);
  const outings = (await allOutings(db)).filter((item) => !item.sample);
  const attachments = await exportPhotos(outings.flatMap(photoList));
  exportsDirectory.create({ idempotent: true, intermediates: true });
  const file = new File(exportsDirectory, `trailcatch-${Date.now()}.json`);
  file.create();
  file.write(JSON.stringify({ version: 1, outings, attachments }, null, 2));
  await shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle: t.export });
}

export default function Profile() {
  const router = useRouter();
  const { session } = useSession();
  const viewer = session?.user.id;
  const p = usePalette();
  const tabClearance = useTabClearance();
  const db = useSQLiteContext();
  const { items, error, load } = useDiary();
  const [busy, setBusy] = useState(false);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [gridWidth, setGridWidth] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [tab, setTab] = useState<GridTab>('outings');
  const [identity, setIdentity] = useState<{ viewer?: string; data: Identity }>();
  const [draft, setDraft] = useState<Identity>();
  const [avatarFailed, setAvatarFailed] = useState<string>();
  const [year, setYear] = useState(() => new Date().getFullYear());
  useFocusEffect(useCallback(() => {
    let active = true;
    setYear(new Date().getFullYear());
    void (async () => {
      try {
        const result = viewer && backend ? await backend.from('profiles').select('display_name,bio,avatar_url').eq('id', viewer).maybeSingle() : null;
        if (result?.error) throw result.error;
        const stored = !viewer ? await Storage.getItem(identityKey) : null;
        const data = result?.data ?? (stored ? JSON.parse(stored) as Identity : defaultIdentity);
        if (active) setIdentity({ viewer, data });
      } catch { if (active) setIdentity((current) => current?.viewer === viewer ? current : undefined); }
    })();
    return () => { active = false; setMenuOpen(false); setDraft(undefined); };
  }, [viewer]));
  useFocusEffect(useCallback(() => {
    if (!menuOpen) return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      setMenuOpen(false);
      return true;
    });
    return () => listener.remove();
  }, [menuOpen]));

  const outings = items ?? noOutings;
  const tiles = useMemo(() => makeTiles(outings, tab), [outings, tab]);
  const tileWidth = Math.max(0, (gridWidth - gridGap * 2) / 3);
  const annual = useMemo(() => annualStats(outings, year), [outings, year]);
  const peak = Math.max(1, ...annual.months);
  const currentIdentity = identity?.viewer === viewer ? identity?.data ?? defaultIdentity : defaultIdentity;
  const metadata = session?.user.user_metadata;
  const name = currentIdentity.display_name;
  const handle = profileHandle(metadata?.preferred_username ?? metadata?.user_name, name);
  const avatar = currentIdentity.avatar_url;

  async function saveIdentity() {
    if (!draft?.display_name.trim() || busy) return;
    setBusy(true);
    try {
      const data = { display_name: draft.display_name.trim(), bio: draft.bio.trim(), avatar_url: draft.avatar_url?.trim() || null };
      await Storage.setItem(identityKey, JSON.stringify(data));
      setIdentity({ data });
      setDraft(undefined);
    } catch { Alert.alert(t.accountError); }
    finally { setBusy(false); }
  }

  async function exportData() {
    if (busy) return;
    setBusy(true);
    try { await shareDiary(db); }
    catch { Alert.alert(t.exportError); }
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
    [t.outings, numberFormatter.format(outings.length)],
    [t.catches, numberFormatter.format(outings.reduce((total, item) => total + item.catches.length, 0))],
    [t.largestCatch, largestCatch(outings)], [t.lastOuting, outings[0] ? formatDate(outings[0].date) : '—'],
  ];
  const empty = error ? <Notice message={t.loadError} retry={() => void load()} />
    : !items ? <Notice message={t.loading} loading />
    : !outings.length ? <View style={profileStyles.empty}>
      <Ionicons name="camera-outline" size={30} color={p.accent} />
      <Text style={[profileStyles.emptyLabel, { color: p.muted }]}>{t.empty}</Text>
      <Button label={t.addFirstOuting} icon="add" primary onPress={() => router.push('/create')} />
    </View>
    : <Notice message={tab === 'catches' ? t.noCatchPhotos : t.noSavedOutings} />;

  return <TabContent name="profile">
    <Header title={t.profile}>
      <IconButton name="menu-outline" label={t.profileMenu} align="end" expanded={menuOpen}
        onPress={() => setMenuOpen((open) => !open)} />
    </Header>
    <View style={styles.screen}>
      <FlatList data={tileWidth ? tiles.slice(0, limit) : []} numColumns={3} keyExtractor={(item) => item.key}
        onEndReached={() => { if (limit < tiles.length) setLimit((value) => value + PAGE_SIZE); }}
        accessibilityElementsHidden={menuOpen} importantForAccessibility={menuOpen ? 'no-hide-descendants' : 'auto'}
        style={styles.screen} contentInsetAdjustmentBehavior="never" keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets
        onLayout={({ nativeEvent }) => setGridWidth(nativeEvent.layout.width)}
        contentContainerStyle={{ paddingBottom: tabClearance }}
        columnWrapperStyle={{ gap: gridGap, marginBottom: gridGap }}
        ListHeaderComponent={<View style={profileStyles.summary}>
          <View style={profileStyles.identity}>
            {avatar && avatarFailed !== avatar
              ? <Image key={avatar} source={{ uri: avatar }} onError={() => setAvatarFailed(avatar)} style={profileStyles.avatar} />
              : <Avatar size={64} />}
            <View style={profileStyles.identityText}>
              <Text accessibilityRole="header" numberOfLines={2} style={[profileStyles.name, { color: p.ink }]}>{name}</Text>
              <Text numberOfLines={1} style={{ color: p.accent, fontWeight: '600' }}>{handle}</Text>
              {!!currentIdentity.bio.trim() && <Text numberOfLines={3} style={{ color: p.muted }}>{currentIdentity.bio.trim()}</Text>}
            </View>
          </View>
          {draft ? <View style={styles.group}>
            <Field label={t.displayName} value={draft.display_name} maxLength={80}
              onChangeText={(display_name) => setDraft({ ...draft, display_name })} />
            <Field label={t.bio} value={draft.bio} maxLength={160} multiline onChangeText={(bio) => setDraft({ ...draft, bio })} />
            <Field label={t.avatarUrl} value={draft.avatar_url ?? ''} autoCapitalize="none" keyboardType="url"
              onChangeText={(avatar_url) => setDraft({ ...draft, avatar_url })} />
            <View style={styles.columns}>
              <Button label={t.cancel} stretch disabled={busy} onPress={() => setDraft(undefined)} />
              <Button label={t.saveProfile} primary stretch disabled={busy || !draft.display_name.trim()} onPress={() => void saveIdentity()} />
            </View>
          </View> : <Button label={t.editProfile} icon="pencil-outline" onPress={() => {
            if (viewer) router.push('/account'); else setDraft(currentIdentity);
          }} />}
          <View style={[profileStyles.counts, { borderColor: p.line, backgroundColor: p.field }]}>
            {counts.map(([label, count]) => <View key={label} style={profileStyles.stat}>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}
                style={[profileStyles.count, { color: p.accent }]}>{items ? count : '—'}</Text>
              <Text style={[profileStyles.statLabel, { color: p.muted }]}>{label}</Text>
            </View>)}
          </View>
          <Pressable cssInterop={false} accessibilityRole="button"
            accessibilityLabel={`${t.annual}, ${year}, ${t.outings} ${annual.total}, ${t.catches} ${annual.catches}`}
            onPress={() => router.push('/stats')} style={({ pressed }) => [profileStyles.annual, {
              backgroundColor: pressed ? p.soft : p.surface, borderColor: p.line,
            }]}>
            <View style={profileStyles.annualHeader}>
              <Text style={[styles.section, profileStyles.annualTitle, { color: p.ink }]}>{t.annual}</Text>
              <Text style={{ color: p.muted, fontWeight: '600' }}>{year}</Text>
              <Ionicons name="chevron-forward" size={16} color={p.accent} />
            </View>
            <View style={profileStyles.chart} accessible={false} importantForAccessibility="no-hide-descendants">
              {annual.months.map((count, month) => <View key={month} style={[profileStyles.chartBar, {
                height: 3 + 33 * count / peak, backgroundColor: count ? p.accent : p.soft,
              }]} />)}
            </View>
            <View style={styles.row}>
              <Text style={[profileStyles.total, { color: p.muted }]}>{t.outings} <Text style={{ color: p.accent }}>{annual.total}</Text></Text>
              <Text style={[profileStyles.total, { color: p.muted }]}>{t.catches} <Text style={{ color: p.accent }}>{annual.catches}</Text></Text>
            </View>
          </Pressable>
          <View accessibilityRole="tablist" style={[profileStyles.tabs, { borderColor: p.line }]}>
            {gridTabs.map((key) => <Pressable key={key} cssInterop={false} accessibilityRole="tab"
              accessibilityState={{ selected: tab === key }} onPress={() => { setTab(key); setLimit(PAGE_SIZE); }}
              style={[profileStyles.tab, { borderColor: tab === key ? p.accent : 'transparent' }]}>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}
                style={[profileStyles.tabLabel, { color: tab === key ? p.accent : p.muted }]}>{t[key]}</Text>
            </Pressable>)}
          </View>
          {tab === 'saved' && viewer && <Button label={t.savedPosts} icon="bookmark-outline" onPress={() => router.push('/saved')} />}
          {tab === 'outings' && outings.length > 0 && outings.every((item) => item.sample) &&
            <Button label={t.addFirstOuting} icon="add" onPress={() => router.push('/create')} />}
        </View>}
        ListEmptyComponent={!tiles.length ? empty : undefined}
        renderItem={({ item }) => <Link href={{ pathname: '/outing/[id]', params: { id: item.id } }} asChild>
          <Pressable accessibilityRole="button" accessibilityLabel={`${item.title}, ${t[item.type]}, ${formatDate(item.date)}`}
            style={{ width: tileWidth }}>
            <View style={[profileStyles.tile, { backgroundColor: p.soft }]}>
              {item.photo ? <Image source={photoSource(item.photo)} style={StyleSheet.absoluteFill}
                recyclingKey={item.key} cachePolicy="memory" transition={140} />
                : <Ionicons name="image-outline" size={24} color={p.accent} />}
            </View>
            <View style={profileStyles.tileMeta}>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}
                style={[profileStyles.typeChip, { backgroundColor: p.soft, color: p.accent }]}>{t[item.type]}</Text>
              <Text numberOfLines={1} style={[profileStyles.tileDate, { color: p.muted }]}>{formatDate(item.date)}</Text>
            </View>
          </Pressable>
        </Link>} />
      {menuOpen && <>
        <Pressable accessibilityRole="button" accessibilityLabel={t.closeMenu}
          onPress={() => setMenuOpen(false)} style={profileStyles.scrim} />
        <View pointerEvents="box-none" style={[profileStyles.menuAnchor, { bottom: tabClearance }]}>
          <ScrollView accessibilityRole="menu" accessibilityViewIsModal onAccessibilityEscape={() => setMenuOpen(false)}
            style={[profileStyles.menu, { backgroundColor: p.surface, borderColor: p.line }]} bounces={false}>
            {menuItem(t.export, 'download-outline', () => void exportData(), false, busy)}
            {viewer && menuItem(t.posts, 'images-outline', () => router.push({ pathname: '/user/[id]', params: { id: viewer } }))}
            {menuItem(t.account, 'person-circle-outline', () => router.push('/account'))}
            <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: p.line }} />
            {menuItem(t.deleteSamples, 'trash-outline', () => confirm(true), false, busy || !items?.some((item) => item.sample))}
            {menuItem(t.deleteAll, 'alert-circle-outline', () => confirm(false), true, busy)}
            <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: p.line }} />
            {menuItem(t.privacy, 'shield-checkmark-outline', () => router.push('/privacy'))}
            {menuItem(t.terms, 'document-text-outline', () => router.push('/terms'))}
          </ScrollView>
        </View>
      </>}
    </View>
  </TabContent>;
}


const profileStyles = StyleSheet.create({
  summary: { paddingTop: 20, paddingBottom: 12, paddingHorizontal: side, gap: 14 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  identityText: { flex: 1, minWidth: 0, gap: 3 },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  name: { fontSize: 23, fontWeight: '800', letterSpacing: -0.4 },
  counts: { flexDirection: 'row', gap: 4, borderWidth: 1, borderRadius: 16, paddingVertical: 11, paddingHorizontal: 6 },
  stat: { flex: 1, minWidth: 0, alignItems: 'center', gap: 4 },
  count: { width: '100%', textAlign: 'center', fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 12, textAlign: 'center', width: '100%' },
  annual: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 10 },
  annualHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  annualTitle: { flex: 1, fontSize: 16 },
  chart: { height: 36, flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  chartBar: { flex: 1, borderRadius: 3 },
  total: { fontWeight: '600', fontSize: 13 },
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, minWidth: 0, justifyContent: 'center', minHeight: 44, borderBottomWidth: 2, paddingHorizontal: 4 },
  tabLabel: { textAlign: 'center', fontSize: 14, fontWeight: '700' },
  tile: { width: '100%', aspectRatio: 1, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  tileMeta: { alignItems: 'flex-start', paddingHorizontal: 4, paddingVertical: 5, gap: 3 },
  typeChip: { maxWidth: '100%', borderRadius: 8, paddingVertical: 3, paddingHorizontal: 6, fontSize: 11, fontWeight: '700' },
  tileDate: { maxWidth: '100%', fontSize: 11, fontVariant: ['tabular-nums'] },
  empty: { alignItems: 'center', gap: 12, paddingVertical: 20, paddingHorizontal: side },
  emptyLabel: { textAlign: 'center' },
  scrim: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: '#10191470', zIndex: 1 },
  menuAnchor: { position: 'absolute', top: 4, left: side, right: side, zIndex: 2, alignItems: 'flex-end' },
  menu: { width: 240, maxWidth: '100%', flexGrow: 0, borderWidth: 1, borderRadius: 16,
    elevation: 6, shadowColor: '#12251B', shadowOpacity: 0.16, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  menuItem: { minHeight: 48, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  itemLabel: { flex: 1, fontSize: 14, fontWeight: '600' },
});
