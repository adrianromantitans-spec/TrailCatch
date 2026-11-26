import { Ionicons } from '@expo/vector-icons';
import { Directory, File, Paths } from 'expo-file-system';
import { Image } from 'expo-image';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import { isAvailableAsync, shareAsync } from 'expo-sharing';
import { useSQLiteContext } from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import Storage from 'expo-sqlite/kv-store';
import { useCallback, useMemo, useState } from 'react';
import { Alert, BackHandler, Pressable, ScrollView, SectionList, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { AnnualBars, monthName } from '../../components/AnnualBars';
import { TabContent, useTabClearance } from '../../components/GlassTabBar';
import { FeedHeader } from '../../components/FeedHeader';
import { GridSkeleton } from '../../components/Skeleton';
import { Avatar, Button, EmptyState, Field, IconButton, IconName, Notice, onBrand, styles, usePalette } from '../../components/ui';
import { allOutings, deleteOutings } from '../../db/diary';
import { localDate, PAGE_SIZE, photoList } from '../../db/model';
import type { Outing, OutingType, Photo } from '../../db/model';
import { useDiary } from '../../db/useDiary';
import { formatDiaryCount, locale, t } from '../../i18n';
import { backend, useSession } from '../../services/backend';
import { exportPhotos, photoSource, removeAllPhotos } from '../../services/photos';
import { annualStats, diaryStats } from '../../services/stats';

const gridGap = 2;
const profileSide = 16;
const avatarSize = 72;
const exportsDirectory = new Directory(Paths.cache, 'trailcatch-exports');
const identityKey = 'trailcatch-diary-profile';
const gridTabs = ['outings', 'catches', 'saved'] as const;
type GridTab = typeof gridTabs[number];
type Identity = { display_name: string; bio: string; avatar_url: string | null };
type GridTile = { key: string; id: string; title: string; date: string; type: OutingType; photo?: Photo; species?: string; hasCatch: boolean; length: number };
const defaultIdentity: Identity = { display_name: t.personal, bio: '', avatar_url: null };
const noOutings: Outing[] = [];
const dateFormatter = new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'UTC' });
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

const speciesKey = (value: string) => value.trim().toLocaleLowerCase(locale).normalize('NFD').replace(/\p{Diacritic}/gu, '');

function makeTiles(outings: Outing[], tab: GridTab, species?: string): GridTile[] {
  return outings.flatMap((entry) => {
    const { id, title, date, type } = entry;
    if (tab === 'saved' && !entry.saved) return [];
    if (tab === 'catches') {
      return entry.catches.flatMap((capture, index) => !species || speciesKey(capture.species ?? '') === species
        ? [{ id, title, date, type, key: `${id}-catch-${index}`, photo: capture.photo, species: capture.species || t.species,
          hasCatch: true, length: Number.isFinite(capture.size) ? capture.size ?? 0 : 0 }] : []);
    }
    const photos = tab === 'saved' ? photoList(entry) : entry.photos;
    const length = entry.catches.reduce((maximum, item) => Number.isFinite(item.size) ? Math.max(maximum, item.size ?? 0) : maximum, 0);
    const tile = { id, title, date, type, hasCatch: entry.catches.length > 0, length };
    return photos.length ? photos.map((photo, index) => ({ ...tile, key: `${id}-${index}`, photo }))
      : [{ ...tile, key: id }];
  });
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
  const { catches, distance, biggestCatch, longestOuting, mostActiveMonth } = diaryStats(outings);
  const years = new Set(outings.map((item) => Number(item.date.slice(0, 4))).filter((year) => year > 0 && year <= 9999));
  const statistics = {
    outings: outings.length, catches, totalKm: distance, lastOutingDate: outings[0]?.date,
    records: {
      biggestCatch: biggestCatch && { outingId: biggestCatch.outing.id, species: biggestCatch.capture.species, size: biggestCatch.size },
      longestOuting: longestOuting && { outingId: longestOuting.outing.id, distance: longestOuting.distance },
      mostActiveMonth,
    },
    annual: Object.fromEntries([...years].sort((a, b) => b - a).map((year) => [year, annualStats(outings, year)])),
  };
  exportsDirectory.create({ idempotent: true, intermediates: true });
  const file = new File(exportsDirectory, `trailcatch-${Date.now()}.json`);
  file.create();
  file.write(JSON.stringify({ version: 1, outings, attachments, statistics }, null, 2));
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
  const [annualOpen, setAnnualOpen] = useState(false);
  const [recordsOpen, setRecordsOpen] = useState(false);
  const [tab, setTab] = useState<GridTab>('outings');
  const [species, setSpecies] = useState<string>();
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
  const speciesOptions = useMemo(() => {
    const names = new Map<string, string>();
    for (const outing of outings) for (const capture of outing.catches) {
      const name = capture.species?.trim();
      if (name && !names.has(speciesKey(name))) names.set(speciesKey(name), name);
    }
    return [...names].sort(([, a], [, b]) => a.localeCompare(b, locale));
  }, [outings]);
  const activeSpecies = speciesOptions.some(([key]) => key === species) ? species : undefined;
  const tiles = useMemo(() => makeTiles(outings, tab, activeSpecies), [activeSpecies, outings, tab]);
  const sections = useMemo(() => {
    const data: GridTile[][] = [];
    if (gridWidth > profileSide * 2 + gridGap * 2) {
      const visible = tiles.slice(0, limit);
      for (let index = 0; index < visible.length; index += 3) data.push(visible.slice(index, index + 3));
    }
    return [{ key: 'photos', data }];
  }, [gridWidth, limit, tiles]);
  const stats = useMemo(() => diaryStats(outings), [outings]);
  const tileWidth = Math.max(0, (gridWidth - profileSide * 2 - gridGap * 2) / 3);
  const year = Number(today.slice(0, 4));
  const currentMonth = Number(today.slice(5, 7)) - 1;
  const annual = useMemo(() => annualStats(outings, year), [outings, year]);

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

  const bestSize = stats.biggestCatch ? `${numberFormatter.format(stats.biggestCatch.size)} ${t.units.cm}` : '—';
  const counts = [
    [t.outingUnit(outings.length), numberFormatter.format(outings.length)],
    [t.catchUnit(stats.catches), numberFormatter.format(stats.catches)],
    [t.largestCatch, bestSize],
    [t.totalKm, `${numberFormatter.format(stats.distance)} ${t.units.km}`],
    [t.lastOuting, outings[0] ? formatLastOuting(outings[0].date, today) : '—'],
  ];
  const recordMonth = stats.mostActiveMonth;
  const records = [
    [t.largestCatch, stats.biggestCatch ? `${stats.biggestCatch.capture.species || t.species} · ${bestSize}` : '—'],
    [t.longestOuting, stats.longestOuting ? `${stats.longestOuting.outing.title} · ${numberFormatter.format(stats.longestOuting.distance)} ${t.units.km}` : '—'],
    [t.mostActiveMonth, recordMonth ? `${monthName(Number(recordMonth.key.slice(5, 7)) - 1)} ${recordMonth.key.slice(0, 4)} · ${formatDiaryCount(recordMonth.count, 'outings')}` : '—'],
  ];
  const openStats = (month?: number) => router.push({ pathname: '/stats', params: {
    year: String(year), ...(month === undefined ? {} : { month: String(month + 1) }),
  } });
  const empty = error ? <Notice message={t.loadError} retry={() => void load()} />
    : !items ? <GridSkeleton profile inset={0} />
    : !outings.length ? <EmptyState icon="camera-outline" message={t.empty}
      action={t.addFirstOuting} onAction={() => router.push('/create')} />
    : <EmptyState icon={tab === 'catches' ? 'fish-outline' : 'bookmark-outline'}
      message={tab === 'catches' ? (activeSpecies ? t.noSpeciesCatches : t.noCatchPhotos) : t.noSavedOutings}
      action={tab === 'catches' ? (activeSpecies ? t.allSpecies : t.create) : t.diary}
      onAction={() => {
        if (tab !== 'catches') setTab('outings');
        else if (activeSpecies) setSpecies(undefined);
        else router.push('/create');
      }} />;

  const footer = tab === 'saved' && viewer ? <View style={profileStyles.footer}>
    <Button label={t.savedPosts} icon="bookmark-outline" onPress={() => router.push('/saved')} />
  </View> : tab === 'outings' && outings.length > 0 && outings.every((item) => item.sample) ? <View style={profileStyles.footer}>
    <Button label={t.addFirstOuting} icon="add" onPress={() => router.push('/create')} />
  </View> : undefined;

  return <TabContent name="profile">
    <FeedHeader safeTop align="left" title={t.profile}
      action={<IconButton name="menu-outline" label={t.profileMenu} align="end" expanded={menuOpen}
        onPress={() => setMenuOpen((open) => !open)} />} />
    <View style={styles.screen}>
      <SectionList sections={sections} stickySectionHeadersEnabled keyExtractor={(row) => row[0].key}
        onEndReached={() => { if (limit < tiles.length) setLimit((value) => value + PAGE_SIZE); }}
        accessibilityElementsHidden={menuOpen} importantForAccessibility={menuOpen ? 'no-hide-descendants' : 'auto'}
        style={styles.screen} contentInsetAdjustmentBehavior="never" keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets
        onLayout={({ nativeEvent }) => setGridWidth(nativeEvent.layout.width)}
        contentContainerStyle={{ paddingBottom: tabClearance, paddingHorizontal: profileSide }}
        ListHeaderComponent={(items || error) ? <View style={profileStyles.summary}>
          <View style={profileStyles.identity}>
            <View style={[profileStyles.avatarRing, { borderColor: p.accent }]}>
              {avatar && avatarFailed !== avatar
                ? <Image key={avatar} source={{ uri: avatar }} onError={() => setAvatarFailed(avatar)} style={profileStyles.avatar} />
                : <Avatar size={avatarSize} />}
            </View>
            <View style={profileStyles.identityText}>
              <Text accessibilityRole="header" numberOfLines={2} style={[profileStyles.name, { color: p.ink }]}>{name}</Text>
              <Text numberOfLines={1} style={[profileStyles.handle, { color: p.accent }]}>{handle}</Text>
              {!draft && <Pressable cssInterop={false} accessibilityRole="button" accessibilityLabel={t.editProfile} hitSlop={4}
                onPress={() => { if (viewer) router.push('/account'); else setDraft(currentIdentity); }}
                style={({ pressed }) => [profileStyles.edit, { borderColor: p.line, backgroundColor: pressed ? p.soft : p.surface }]}>
                <Ionicons name="pencil-outline" size={13} color={p.accent} />
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}
                  style={[profileStyles.editLabel, { color: p.accent }]}>{t.editProfile}</Text>
              </Pressable>}
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
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={profileStyles.counts}>
            {counts.map(([label, count]) => <View key={label} style={[profileStyles.stat, { backgroundColor: p.field }]}>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}
                style={[profileStyles.count, { color: p.accent }]}>{items ? count : '—'}</Text>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}
                style={[profileStyles.statLabel, { color: p.muted }]}>{label}</Text>
            </View>)}
          </ScrollView>
          <View style={[profileStyles.annual, { backgroundColor: p.field }]}>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: annualOpen }}
              onPress={() => setAnnualOpen((open) => !open)} style={profileStyles.annualHeading}>
              <Text style={[profileStyles.annualTitle, profileStyles.annualCopy, { color: p.ink }]}>{t.annual}</Text>
              <Ionicons name={annualOpen ? 'chevron-up' : 'chevron-down'} size={16} color={p.accent} />
            </Pressable>
            {annualOpen && <View style={profileStyles.sectionBody}>
              <Text style={[profileStyles.total, { color: p.muted }]}>
                {`${year} · ${formatDiaryCount(annual.total, 'outings')} · ${formatDiaryCount(annual.catches, 'catches')}`}
              </Text>
              <AnnualBars counts={annual.months} active={currentMonth} onSelect={openStats} />
              <Button label={t.viewAnnualStats} onPress={() => openStats()} />
            </View>}
          </View>
          <View style={[profileStyles.annual, { backgroundColor: p.field }]}>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: recordsOpen }}
              onPress={() => setRecordsOpen((open) => !open)} style={profileStyles.annualHeading}>
              <Text style={[profileStyles.annualTitle, profileStyles.annualCopy, { color: p.ink }]}>{t.records}</Text>
              <Ionicons name={recordsOpen ? 'chevron-up' : 'chevron-down'} size={16} color={p.accent} />
            </Pressable>
            {recordsOpen && <View style={profileStyles.sectionBody}>
              {records.map(([label, value]) => <View key={label} style={profileStyles.record}>
                <Text numberOfLines={1} ellipsizeMode="tail" style={[profileStyles.recordLabel, { color: p.muted }]}>{label}</Text>
                <Text numberOfLines={1} ellipsizeMode="tail" style={[profileStyles.recordValue, { color: p.accent }]}>{value}</Text>
              </View>)}
            </View>}
          </View>
        </View> : undefined}
        renderSectionHeader={() => (items || error) ? <View style={{ backgroundColor: p.bg }}>
          <View accessibilityRole="tablist" style={profileStyles.tabs}>
            {gridTabs.map((key) => <Pressable key={key} cssInterop={false} accessibilityRole="tab"
              accessibilityState={{ selected: tab === key }} onPress={() => { setTab(key); setLimit(PAGE_SIZE); }}
              style={[profileStyles.tab, { borderColor: tab === key ? p.accent : 'transparent' }]}>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}
                style={[profileStyles.tabLabel, { color: tab === key ? p.accent : p.muted }]}>{t[key]}</Text>
            </Pressable>)}
          </View>
          {tab === 'catches' && !!speciesOptions.length && <ScrollView horizontal showsHorizontalScrollIndicator={false}
            accessibilityLabel={t.filterSpecies} contentContainerStyle={profileStyles.speciesFilters}>
            <Button label={t.allSpecies} selected={!activeSpecies} onPress={() => { setSpecies(undefined); setLimit(PAGE_SIZE); }} />
            {speciesOptions.map(([key, name]) => <Button key={key} label={name} selected={key === activeSpecies}
              onPress={() => { setSpecies(key); setLimit(PAGE_SIZE); }} />)}
          </ScrollView>}
        </View> : null}
        renderSectionFooter={() => !tiles.length ? empty : null}
        ListFooterComponent={footer}
        renderItem={({ item: row }) => <View style={profileStyles.gridRow}>{row.map((item) => {
          const date = formatDate(item.date);
          const measured = item.length > 0 ? `${numberFormatter.format(item.length)} ${t.units.cm}` : '';
          const catchLabel = [item.species, measured].filter(Boolean).join(' · ') || t.catches;
          return <Link key={item.key} href={{ pathname: '/outing/[id]', params: { id: item.id } }} asChild>
            <Pressable accessibilityRole="button"
              accessibilityLabel={[item.title, t[item.type], date, item.hasCatch && catchLabel].filter(Boolean).join(', ')}
              style={StyleSheet.flatten([profileStyles.tile, { width: tileWidth, backgroundColor: p.soft }])}>
              {item.photo ? <Image source={photoSource(item.photo)} style={StyleSheet.absoluteFill}
                recyclingKey={item.key} cachePolicy="memory" transition={140} />
                : <Ionicons name={item.species ? 'fish-outline' : 'image-outline'} size={24} color={p.accent} />}
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
                {(!!item.species || !!measured) && <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} maxFontSizeMultiplier={1.3}
                  style={[profileStyles.catchLabel, { color: onBrand }]}>{catchLabel}</Text>}
              </View>}
              <View pointerEvents="none" style={profileStyles.tileMeta}>
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} maxFontSizeMultiplier={1.3}
                  style={[profileStyles.typeChip, { backgroundColor: p.soft, color: p.accent }]}>{t[item.type]}</Text>
                <Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={[profileStyles.tileDate, { color: onBrand }]}>{date}</Text>
              </View>
            </Pressable>
          </Link>;
        })}</View>} />
      {menuOpen && <>
        <Pressable accessibilityRole="button" accessibilityLabel={t.closeMenu}
          onPress={() => setMenuOpen(false)} style={profileStyles.scrim} />
        <View pointerEvents="box-none" style={[profileStyles.menuAnchor, { bottom: tabClearance }]}>
          <ScrollView accessibilityRole="menu" accessibilityViewIsModal onAccessibilityEscape={() => setMenuOpen(false)}
            style={[profileStyles.menu, { backgroundColor: p.surface }]} bounces={false}>
            {menuItem(t.searchDiary, 'search-outline', () => router.push('/diary-search'))}
            {menuItem(t.export, 'download-outline', () => void exportData(), false, busy)}
            {viewer && menuItem(t.posts, 'images-outline', () => router.push({ pathname: '/user/[id]', params: { id: viewer } }))}
            {menuItem(t.account, 'settings-outline', () => router.push('/account'))}
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
  summary: { paddingTop: 8, paddingBottom: 8, gap: 8 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  identityText: { flex: 1, minWidth: 0, gap: 2 },
  avatarRing: { padding: 3, borderWidth: 1, borderRadius: (avatarSize + 8) / 2 },
  avatar: { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 },
  name: { maxWidth: '100%', flexShrink: 1, fontSize: 20, fontWeight: '700' },
  edit: { flexDirection: 'row', gap: 4, height: 36, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center',
    marginTop: 4, paddingHorizontal: 8, borderWidth: StyleSheet.hairlineWidth, borderRadius: 8 },
  editLabel: { flexShrink: 1, fontSize: 12, fontWeight: '700' },
  handle: { fontSize: 13 },
  bio: { fontSize: 13 },
  counts: { gap: 6 },
  stat: { width: 94, minWidth: 0, padding: 6, borderRadius: 10, alignItems: 'center', gap: 2 },
  count: { width: '100%', textAlign: 'center', fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 11, textAlign: 'center', width: '100%', textTransform: 'capitalize' },
  annual: { borderRadius: 10, paddingHorizontal: 10 },
  annualHeading: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionBody: { gap: 8, paddingBottom: 10 },
  record: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', columnGap: 8, rowGap: 3 },
  recordLabel: { maxWidth: '100%', fontSize: 12 },
  recordValue: { maxWidth: '100%', fontSize: 13, fontWeight: '700' },
  speciesFilters: { gap: 8, paddingVertical: 4 },
  annualCopy: { flex: 1, minWidth: 0 },
  annualTitle: { fontSize: 14, fontWeight: '700' },
  total: { fontSize: 11 },
  tabs: { flexDirection: 'row' },
  tab: { flex: 1, minWidth: 0, justifyContent: 'center', minHeight: 44, borderBottomWidth: 2, paddingHorizontal: 4 },
  tabLabel: { textAlign: 'center', fontSize: 14, fontWeight: '700' },
  gridRow: { flexDirection: 'row', gap: gridGap, marginBottom: gridGap },
  tile: { aspectRatio: 1, borderRadius: 9, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  tileShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '60%' },
  tileMeta: { position: 'absolute', left: 4, right: 4, bottom: 4, alignItems: 'flex-start', gap: 2 },
  typeChip: { maxWidth: '100%', borderRadius: 6, paddingVertical: 2, paddingHorizontal: 4, fontSize: 10, fontWeight: '700' },
  tileDate: { maxWidth: '100%', fontSize: 10, fontWeight: '700', fontVariant: ['tabular-nums'] },
  catchChip: { position: 'absolute', top: 4, right: 4, maxWidth: '85%', paddingVertical: 2, paddingHorizontal: 4,
    borderRadius: 6, backgroundColor: '#10221AE6', flexDirection: 'row', alignItems: 'center', gap: 3 },
  catchLabel: { flexShrink: 1, fontSize: 10, fontWeight: '700' },
  footer: { marginTop: 8 },
  scrim: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: '#10191470', zIndex: 1 },
  menuAnchor: { position: 'absolute', top: 4, left: profileSide, right: profileSide, zIndex: 2, alignItems: 'flex-end' },
  menu: { width: 240, maxWidth: '100%', flexGrow: 0, borderRadius: 16,
    elevation: 6, shadowColor: '#12251B', shadowOpacity: 0.16, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  menuItem: { minHeight: 48, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  itemLabel: { flex: 1, fontSize: 14, fontWeight: '700' },
});
