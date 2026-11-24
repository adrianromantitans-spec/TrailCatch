import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CategoryBadge, CategoryPicker } from '../components/CategoryPicker';
import { MapView } from '../components/MapView';
import { Button, Field, Header, IconButton, Notice, side, styles, usePalette } from '../components/ui';
import type { OutingType, Point } from '../db/model';
import { t } from '../i18n';
import { backend } from '../services/backend';
import type { Difficulty, Spot } from '../services/spots';

const initial = { latitude: 46.7, longitude: 23.42, latitudeDelta: 0.45, longitudeDelta: 0.45 };
const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value));
const wrapLongitude = (value: number) => ((value + 540) % 360) - 180;
let lastGeocode = 0;
const geocoded = new Map<string, Point | null>();

export default function Spots() {
  const router = useRouter();
  const p = usePalette();
  const inset = useSafeAreaInsets();
  const [region, setRegion] = useState(initial);
  const [destination, setDestination] = useState<Point & { latitudeDelta?: number; longitudeDelta?: number }>();
  const [category, setCategory] = useState<OutingType | 'all'>('all');
  const [difficulty, setDifficulty] = useState<Difficulty>();
  const [name, setName] = useState('');
  const [species, setSpecies] = useState('');
  const [place, setPlace] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [locationMessage, setLocationMessage] = useState('');
  const [retry, setRetry] = useState(() => new AbortController());
  const requestId = useRef(0);

  useFocusEffect(useCallback(() => {
    const client = backend;
    if (!client) return;
    const id = ++requestId.current;
    setLoading(true); setError(false);
    const timer = setTimeout(() => {
      const world = region.longitudeDelta >= 360;
      void client.rpc('spots_in_bounds', {
        west: world ? -180 : wrapLongitude(region.longitude - region.longitudeDelta / 2),
        east: world ? 180 : wrapLongitude(region.longitude + region.longitudeDelta / 2),
        south: clamp(region.latitude - region.latitudeDelta / 2, 90),
        north: clamp(region.latitude + region.latitudeDelta / 2, 90),
        spot_type: category === 'all' ? null : category,
        target_species: species.trim() || null, target_difficulty: difficulty ?? null,
      }).abortSignal(retry.signal).then(({ data, error: failure }) => {
        if (id !== requestId.current) return;
        setSpots((data ?? []) as Spot[]); setError(!!failure); setLoading(false);
      });
    }, 250);
    return () => { ++requestId.current; clearTimeout(timer); };
  }, [region, category, species, difficulty, retry]));

  useEffect(() => () => { ++requestId.current; }, []);
  const visible = spots.filter((spot) => spot.name.toLowerCase().includes(name.trim().toLowerCase()));
  const cells = new Map<string, Spot[]>();
  for (const spot of visible) {
    const north = Math.max(region.latitudeDelta / 8, 0.00001);
    const east = Math.max(region.longitudeDelta / 8, 0.00001);
    const key = `${Math.floor(spot.latitude / north)}:${Math.floor(spot.longitude / east)}`;
    const group = cells.get(key) ?? [];
    group.push(spot);
    cells.set(key, group);
  }
  const pins = Array.from(cells, ([key, group]) => group.length === 1 ? {
    id: group[0].id, title: group[0].name, latitude: group[0].latitude, longitude: group[0].longitude,
  } : {
    id: `cluster:${key}`, title: String(group.length),
    latitude: group.reduce((sum, spot) => sum + spot.latitude, 0) / group.length,
    longitude: group.reduce((sum, spot) => sum + spot.longitude, 0) / group.length,
  });
  const open = (id: string) => router.push({ pathname: '/spot/[id]', params: { id } });

  async function nearMe() {
    setLocationMessage('');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) { setLocationMessage(t.locationDenied); return; }
      const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setDestination({ latitude: coords.latitude, longitude: coords.longitude });
    } catch { setLocationMessage(t.locationError); }
  }

  async function geocode() {
    const query = place.trim();
    if (!query) return;
    setLocationMessage('');
    try {
      if (!geocoded.has(query)) {
        if (Date.now() - lastGeocode < 1000) return;
        lastGeocode = Date.now();
        const params = new URLSearchParams({ q: query, format: 'jsonv2', limit: '1' });
        const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
          headers: { 'User-Agent': 'TrailCatch/1.0 (https://github.com/adrianromantitans-spec/TrailCatch)' },
        });
        if (!response.ok) throw new Error(String(response.status));
        const [first] = await response.json() as { lat: string; lon: string }[];
        geocoded.set(query, first ? { latitude: Number(first.lat), longitude: Number(first.lon) } : null);
      }
      const point = geocoded.get(query);
      if (point) setDestination({ ...point }); else setLocationMessage(t.noResults);
    } catch { setLocationMessage(t.locationError); }
  }

  return <>
    <Header title={t.spots} back={() => router.back()}>
      <IconButton name="add" label={t.newSpot} onPress={() => router.push('/spot/create')} />
      <IconButton name="options-outline" label={t.spotFilters} expanded={expanded} onPress={() => setExpanded(!expanded)} />
    </Header>
    {!backend ? <Notice message={t.backendUnavailable} /> : <FlatList data={visible} keyExtractor={(spot) => spot.id}
      style={styles.screen} contentContainerStyle={[styles.content, { paddingBottom: inset.bottom + side }]}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={<View style={styles.group}>
        <Field label={t.spotSearch} value={name} onChangeText={setName} returnKeyType="search" />
        {expanded && <View style={styles.group}>
          <CategoryPicker mode="filter" value={category} onChange={setCategory} />
          <Field label={t.spotSpecies} value={species} onChangeText={setSpecies} />
          <View style={styles.row}>{(['easy','moderate','hard'] as const).map((choice) =>
            <Button key={choice} label={t[choice]} selected={difficulty === choice}
              onPress={() => setDifficulty(difficulty === choice ? undefined : choice)} />)}</View>
          <Field label={t.placeSearch} value={place} onChangeText={setPlace} onSubmitEditing={() => void geocode()} returnKeyType="search" />
          <Button label={t.search} icon="search-outline" onPress={() => void geocode()} />
        </View>}
        <MapView height={280} movedTo={destination} onViewport={setRegion} pins={pins} onSelect={(id) => {
          if (!id.startsWith('cluster:')) { open(id); return; }
          const pin = pins.find((item) => item.id === id);
          if (pin) setDestination({ latitude: pin.latitude, longitude: pin.longitude,
            latitudeDelta: Math.max(0.001, region.latitudeDelta / 2), longitudeDelta: Math.max(0.001, region.longitudeDelta / 2) });
        }} />
        <Button label={t.nearMe} icon="locate-outline" onPress={() => void nearMe()} />
        {!!locationMessage && <Text style={{ color: p.danger }}>{locationMessage}</Text>}
      </View>}
      ListEmptyComponent={loading ? <Notice message={t.loading} loading /> : error
        ? <Notice message={t.loadError} retry={() => { retry.abort(); setRetry(new AbortController()); }} /> : <Notice message={t.spotsEmpty} />}
      renderItem={({ item }) => <View style={[styles.group, {
        borderWidth: 1, borderColor: p.line, backgroundColor: p.surface, borderRadius: 14, padding: 12,
      }]}>
        <Text style={[styles.section, { color: p.ink }]}>{item.name}</Text>
        <CategoryBadge type={item.type} />
        <Button label={t.openSpot} onPress={() => open(item.id)} />
      </View>} />}
  </>;
}
