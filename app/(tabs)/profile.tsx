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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { TabContent, useTabClearance } from '../../components/GlassTabBar';
import { Avatar, Button, Field, IconButton, IconName, Notice, onBrand, styles, usePalette } from '../../components/ui';
import { allOutings, deleteOutings } from '../../db/diary';
import { localDate, PAGE_SIZE, photoList } from '../../db/model';
import type { Outing, OutingType, Photo } from '../../db/model';
import { useDiary } from '../../db/useDiary';
import { locale, t } from '../../i18n';
import { backend, useSession } from '../../services/backend';
import { exportPhotos, photoSource, removeAllPhotos } from '../../services/photos';
import { annualStats } from '../../services/stats';

const gridGap = 2;
const profileSide = 16;
const avatarSize = 72;
const exportsDirectory = new Directory(Paths.cache, 'trailcatch-exports');
const identityKey = 'trailcatch-diary-profile';
const gridTabs = ['outings', 'catches', 'saved'] as const;
type GridTab = typeof gridTabs[number];
type Identity = { display_name: string; bio: string; avatar_url: string | null };
type GridTile = { key: string; id: string; title: string; date: string; type: OutingType; photo?: Photo; hasCatch: boolean; length: number };
const defaultIdentity: Identity = { display_name: t.personal, bio: '', avatar_url: null };
const noOutings: Outing[] = [];
const dateFormatter = new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'UTC' });
const monthFormatter = new Intl.DateTimeFormat(locale, { month: 'narrow', timeZone: 'UTC' });
const monthInitials = Array.from({ length: 12 }, (_, month) => monthFormatter.format(Date.UTC(2024, month, 1)));
const numberFormatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });

function formatDate(date: string) {
  const value = Date.parse(date);
  return Number.isFinite(value) ? dateFormatter.format(value) : '—';
}

function formatLastOuting(date: string, today: string) {
  const days = (Date.parse(today) - Date.parse(date)) / 86_400_000;
  if (!Number.isFinite(days)) return '—';
  const label = days === 0 ? t.today : days === 1 ? t.yesterday : days > 0 ? t.daysAgo(days) :
    days === -1 ? t.tomorrow : t.inDays(-days);
  return label.charAt(0).toLocaleUpperCase(locale) + label.slice(1);
}

function makeTiles(outings: Outing[], tab: GridTab): GridTile[] {
  return outings.flatMap((entry) => {
    const { id, title, date, type } = entry;
    if (tab === 'saved' && !entry.saved) return [];
    const photos = tab === 'catches' ? entry.catches.flatMap(({ photo }) => photo ? [photo] : [])
      : tab === 'saved' ? photoList(entry) : entry.photos;
    const length = entry.catches.reduce((maximum, item) => Number.isFinite(item.size) ? Math.max(maximum, item.size ?? 0) : maximum, 0);
    const tile = { id, title, date, type, hasCatch: entry.catches.length > 0, length };
    return photos.length ? photos.map((photo, index) => ({ ...tile, key: `${id}-${index}`, photo }))
      : tab === 'catches' ? [] : [{ ...tile, key: id }];
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
  const inset = useSafeAreaInsets();
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
  const [today, setToday] = useState(() => localDate());
  useFocusEffect(useCallback(() => {
    let active = true;
    setToday(localDate());
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
  const tileWidth = Math.max(0, (gridWidth - profileSide * 2 - gridGap * 2) / 3);
  const year = Number(today.slice(0, 4));
  const currentMonth = Number(today.slice(5, 7)) - 1;
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
    [t.largestCatch, largestCatch(outings)], [t.lastOuting, outings[0] ? formatLastOuting(outings[0].date, today) : '—'],
  ];
  const empty = error ? <Notice message={t.loadError} retry={() => void load()} />
    : !items ? <Notice message={t.loading} loading />
    : !outings.length ? <View style={profileStyles.empty}>
      <Ionicons name="camera-outline" size={30} color={p.accent} />
      <Text style={[profileStyles.emptyLabel, { color: p.muted }]}>{t.empty}</Text>
      <Button label={t.addFirstOuting} icon="add" primary onPress={() => router.push('/create')} />
    </View>
    : <Notice message={tab === 'catches' ? t.noCatchPhotos : t.noSavedOutings} />;

  const footer = tab === 'saved' && viewer ? <View style={profileStyles.footer}>
    <Button label={t.savedPosts} icon="bookmark-outline" onPress={() => router.push('/saved')} />
  </View> : tab === 'outings' && outings.length > 0 && outings.every((item) => item.sample) ? <View style={profileStyles.footer}>
    <Button label={t.addFirstOuting} icon="add" onPress={() => router.push('/create')} />
  </View> : undefined;

  return <TabContent name="profile">
    <View style={[profileStyles.header, { paddingTop: inset.top, backgroundColor: p.bg }]}>
      <Text accessibilityRole="header" numberOfLines={1} style={[profileStyles.headerTitle, { color: p.accent }]}>{t.profile}</Text>
      <IconButton name="menu-outline" label={t.profileMenu} align="end" expanded={menuOpen}
        onPress={() => setMenuOpen((open) => !open)} />
    </View>
    <View style={styles.screen}>
      <FlatList data={tileWidth ? tiles.slice(0, limit) : []} numColumns={3} keyExtractor={(item) => item.key}
        onEndReached={() => { if (limit < tiles.length) setLimit((value) => value + PAGE_SIZE); }}
        accessibilityElementsHidden={menuOpen} importantForAccessibility={menuOpen ? 'no-hide-descendants' : 'auto'}
        style={styles.screen} contentInsetAdjustmentBehavior="never" keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets
        onLayout={({ nativeEvent }) => setGridWidth(nativeEvent.layout.width)}
        contentContainerStyle={{ paddingBottom: tabClearance, paddingHorizontal: profileSide }}
        columnWrapperStyle={{ gap: gridGap, marginBottom: gridGap }}
        ListHeaderComponent={<View style={profileStyles.summary}>
          <View style={profileStyles.identity}>
            <View style={[profileStyles.avatarRing, { borderColor: p.accent }]}>
              {avatar && avatarFailed !== avatar
                ? <Image key={avatar} source={{ uri: avatar }} onError={() => setAvatarFailed(avatar)} style={profileStyles.avatar} />
                : <Avatar size={avatarSize} />}
            </View>
            <View style={profileStyles.identityText}>
              <View style={profileStyles.nameRow}>
                <Text accessibilityRole="header" numberOfLines={2} style={[profileStyles.name, { color: p.ink }]}>{name}</Text>
                {!draft && <Pressable cssInterop={false} accessibilityRole="button" accessibilityLabel={t.editProfile} hitSlop={6}
                  onPress={() => { if (viewer) router.push('/account'); else setDraft(currentIdentity); }}
                  style={({ pressed }) => [profileStyles.edit, { borderColor: p.line, backgroundColor: pressed ? p.soft : p.surface }]}>
                  <Ionicons name="pencil-outline" size={13} color={p.accent} />
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}
                    style={[profileStyles.editLabel, { color: p.accent }]}>{t.editProfile}</Text>
                </Pressable>}
              </View>
              <Text numberOfLines={1} style={[profileStyles.handle, { color: p.accent }]}>{handle}</Text>
              {!!currentIdentity.bio.trim() && <Text numberOfLines={2} style={[profileStyles.bio, { color: p.muted }]}>{currentIdentity.bio.trim()}</Text>}
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
          </View> : null}
          <View style={profileStyles.counts}>
            {counts.map(([label, count], index) => <View key={label} style={[profileStyles.stat,
              index > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderColor: p.line }]}>
              <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.75}
                style={[profileStyles.count, { color: p.accent }]}>{items ? count : '—'}</Text>
              <Text style={[profileStyles.statLabel, { color: p.muted }]}>{label}</Text>
            </View>)}
          </View>
          <Pressable cssInterop={false} accessibilityRole="button"
            accessibilityLabel={`${t.annual}, ${year}, ${t.outings} ${annual.total}, ${t.catches} ${annual.catches}`}
            onPress={() => router.push('/stats')} style={({ pressed }) => [profileStyles.annual, {
              backgroundColor: pressed ? p.soft : p.field,
            }]}>
            <View style={profileStyles.annualCopy}>
              <Text style={[profileStyles.annualTitle, { color: p.ink }]}>{t.annual}</Text>
              <Text style={[profileStyles.total, { color: p.muted }]}>{year} · {annual.total} {t.outings.toLocaleLowerCase(locale)} · {annual.catches} {t.catches.toLocaleLowerCase(locale)}</Text>
            </View>
            <View style={profileStyles.chart} accessible={false} importantForAccessibility="no-hide-descendants">
              {annual.months.map((count, month) => <View key={month} style={profileStyles.chartColumn}>
                <View style={[profileStyles.chartBar, {
                  height: 3 + 21 * count / peak, backgroundColor: month === currentMonth ? p.accent : count ? '#74A78D' : p.line,
                }]} />
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65} maxFontSizeMultiplier={1}
                  style={[profileStyles.monthLabel, { color: p.muted },
                    month === currentMonth && { color: onBrand, backgroundColor: p.accent, fontWeight: '700' }]}>
                  {monthInitials[month]}
                </Text>
              </View>)}
            </View>
            <Ionicons name="chevron-forward" size={14} color={p.accent} />
          </Pressable>
          <View accessibilityRole="tablist" style={profileStyles.tabs}>
            {gridTabs.map((key) => <Pressable key={key} cssInterop={false} accessibilityRole="tab"
              accessibilityState={{ selected: tab === key }} onPress={() => { setTab(key); setLimit(PAGE_SIZE); }}
              style={[profileStyles.tab, { borderColor: tab === key ? p.accent : 'transparent' }]}>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}
                style={[profileStyles.tabLabel, { color: tab === key ? p.accent : p.muted }]}>{t[key]}</Text>
            </Pressable>)}
          </View>
        </View>}
        ListEmptyComponent={!tiles.length ? empty : undefined}
        ListFooterComponent={footer}
        renderItem={({ item }) => {
          const date = formatDate(item.date);
          const measured = item.length > 0 ? `${numberFormatter.format(item.length)} ${t.units.cm}` : '';
          const catchLabel = measured || t.catches;
          return <Link href={{ pathname: '/outing/[id]', params: { id: item.id } }} asChild>
            <Pressable accessibilityRole="button"
              accessibilityLabel={[item.title, t[item.type], date, item.hasCatch && catchLabel].filter(Boolean).join(', ')}
              style={StyleSheet.flatten([profileStyles.tile, { width: tileWidth, backgroundColor: p.soft }])}>
              {item.photo ? <Image source={photoSource(item.photo)} style={StyleSheet.absoluteFill}
                recyclingKey={item.key} cachePolicy="memory" transition={140} />
                : <Ionicons name="image-outline" size={24} color={p.accent} />}
              <View pointerEvents="none" style={profileStyles.tileShade}>
                <Svg width="100%" height="100%">
                  <Defs>
                    <LinearGradient id="profileTileShade" x1="0" y1="0" x2="0" y2="1">
                      <Stop offset="0" stopColor="#10221A" stopOpacity={0} />
                      <Stop offset="0.48" stopColor="#10221A" stopOpacity={0.72} />
                      <Stop offset="1" stopColor="#10221A" stopOpacity={0.96} />
                    </LinearGradient>
                  </Defs>
                  <Rect width="100%" height="100%" fill="url(#profileTileShade)" />
                </Svg>
              </View>
              {item.hasCatch && <View pointerEvents="none" style={profileStyles.catchChip}>
                <Ionicons name="fish-outline" size={12} color={onBrand} />
                {!!measured && <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} maxFontSizeMultiplier={1.3}
                  style={[profileStyles.catchLabel, { color: onBrand }]}>{measured}</Text>}
              </View>}
              <View pointerEvents="none" style={profileStyles.tileMeta}>
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} maxFontSizeMultiplier={1.3}
                  style={[profileStyles.typeChip, { backgroundColor: p.soft, color: p.accent }]}>{t[item.type]}</Text>
                <Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={[profileStyles.tileDate, { color: onBrand }]}>{date}</Text>
              </View>
            </Pressable>
          </Link>;
        }} />
      {menuOpen && <>
        <Pressable accessibilityRole="button" accessibilityLabel={t.closeMenu}
          onPress={() => setMenuOpen(false)} style={profileStyles.scrim} />
        <View pointerEvents="box-none" style={[profileStyles.menuAnchor, { bottom: tabClearance }]}>
          <ScrollView accessibilityRole="menu" accessibilityViewIsModal onAccessibilityEscape={() => setMenuOpen(false)}
            style={[profileStyles.menu, { backgroundColor: p.surface }]} bounces={false}>
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
  header: { paddingHorizontal: profileSide, flexDirection: 'row', alignItems: 'center' },
  headerTitle: { flex: 1, fontSize: 21, fontWeight: '700' },
  summary: { paddingTop: 8, paddingBottom: 8, gap: 8 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  identityText: { flex: 1, minWidth: 0, gap: 2 },
  avatarRing: { padding: 3, borderWidth: 1, borderRadius: (avatarSize + 8) / 2 },
  avatar: { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  name: { maxWidth: '100%', flexShrink: 1, fontSize: 20, fontWeight: '700' },
  edit: { flexDirection: 'row', gap: 4, minHeight: 32, maxWidth: '100%', alignItems: 'center',
    paddingHorizontal: 8, borderWidth: StyleSheet.hairlineWidth, borderRadius: 8 },
  editLabel: { flexShrink: 1, fontSize: 12, fontWeight: '700' },
  handle: { fontSize: 13 },
  bio: { fontSize: 13 },
  counts: { flexDirection: 'row', paddingVertical: 8 },
  stat: { flex: 1, minWidth: 0, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'space-between', gap: 2 },
  count: { width: '100%', textAlign: 'center', fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 11, textAlign: 'center', width: '100%' },
  annual: { borderRadius: 12, padding: 8, minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 8 },
  annualCopy: { flex: 1, minWidth: 0, gap: 2 },
  annualTitle: { fontSize: 14, fontWeight: '700' },
  total: { fontSize: 11 },
  chart: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  chartColumn: { flex: 1, minWidth: 0, alignItems: 'stretch' },
  chartBar: { borderRadius: 2, marginHorizontal: 1 },
  monthLabel: { fontSize: 8, lineHeight: 12, textAlign: 'center', borderRadius: 3, marginTop: 2, includeFontPadding: false },
  tabs: { flexDirection: 'row' },
  tab: { flex: 1, minWidth: 0, justifyContent: 'center', minHeight: 44, borderBottomWidth: 2, paddingHorizontal: 4 },
  tabLabel: { textAlign: 'center', fontSize: 14, fontWeight: '700' },
  tile: { aspectRatio: 1, borderRadius: 9, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  tileShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '60%' },
  tileMeta: { position: 'absolute', left: 4, right: 4, bottom: 4, alignItems: 'flex-start', gap: 2 },
  typeChip: { maxWidth: '100%', borderRadius: 6, paddingVertical: 2, paddingHorizontal: 4, fontSize: 10, fontWeight: '700' },
  tileDate: { maxWidth: '100%', fontSize: 10, fontWeight: '700', fontVariant: ['tabular-nums'] },
  catchChip: { position: 'absolute', top: 4, right: 4, maxWidth: '85%', paddingVertical: 2, paddingHorizontal: 4,
    borderRadius: 6, backgroundColor: '#10221AE6', flexDirection: 'row', alignItems: 'center', gap: 3 },
  catchLabel: { flexShrink: 1, fontSize: 10, fontWeight: '700' },
  footer: { marginTop: 8 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 16 },
  emptyLabel: { textAlign: 'center' },
  scrim: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: '#10191470', zIndex: 1 },
  menuAnchor: { position: 'absolute', top: 4, left: profileSide, right: profileSide, zIndex: 2, alignItems: 'flex-end' },
  menu: { width: 240, maxWidth: '100%', flexGrow: 0, borderRadius: 16,
    elevation: 6, shadowColor: '#12251B', shadowOpacity: 0.16, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  menuItem: { minHeight: 48, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  itemLabel: { flex: 1, fontSize: 14, fontWeight: '700' },
});
