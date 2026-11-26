import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FeedHeader } from '../components/FeedHeader';
import { initialMapRegion, MapView } from '../components/MapView';
import type { MapRegion } from '../components/MapView';
import { Button, IconButton, styles, usePalette } from '../components/ui';
import type { Point } from '../db/model';
import { t } from '../i18n';
import { europeanFishingAreas } from '../services/europeanFishingAreas';
import { europeanTrailAreas } from '../services/europeanTrailAreas';
import { discoverMap, discoveryBounds, focusDiscoveryRegion, trailNearPoint } from '../services/mapDiscovery';
import type { Bounds, DiscoveryFeature, DiscoveryKind, TrailCursor } from '../services/mapDiscovery';

const initialRegion = { ...initialMapRegion, latitudeDelta: 0.075, longitudeDelta: 0.075 };
const europeRegion = { latitude: 52, longitude: 8, latitudeDelta: 42, longitudeDelta: 74 };

export default function DiscoverMap() {
  const router = useRouter();
  const p = usePalette();
  const { bottom } = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [kind, setKind] = useState<DiscoveryKind>('trails');
  const [region, setRegion] = useState(initialRegion);
  const [destination, setDestination] = useState<Point & Partial<MapRegion>>();
  const [items, setItems] = useState<DiscoveryFeature[]>([]);
  const [selected, setSelected] = useState<DiscoveryFeature>();
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'empty' | 'error'>('idle');
  const [locating, setLocating] = useState(false);
  const [continuation, setContinuation] = useState<{ bounds: Bounds; cursor: TrailCursor }>();
  const request = useRef<AbortController>(null);
  const mounted = useRef(false);
  const searchRegion = focusDiscoveryRegion(region);
  const bounds = discoveryBounds(searchRegion);
  const pinColor = kind === 'trails' ? '#255A46' : '#28687C';
  const catalog = (kind === 'fishing' ? europeanFishingAreas : europeanTrailAreas).filter(({ point }) =>
    Math.abs(point.latitude - region.latitude) <= region.latitudeDelta / 2 &&
    Math.abs(point.longitude - region.longitude) <= region.longitudeDelta / 2);
  const features = [...catalog, ...items];
  const guide = selected?.guide;
  const nextPage = continuation && kind === 'trails' && searchRegion === region &&
    region.latitude >= continuation.bounds[0] && region.latitude <= continuation.bounds[2] &&
    region.longitude >= continuation.bounds[1] && region.longitude <= continuation.bounds[3] ? continuation : undefined;
  const markerFeatures = kind === 'trails' ? features.filter((feature) =>
    feature.guide || (feature.name && feature.id.startsWith('relation/')) || feature.id === selected?.id) : features;
  const featureName = (feature: DiscoveryFeature) => feature.name || (kind === 'trails' ? t.unnamedTrail : t.fishingPlace);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; request.current?.abort(); };
  }, []);

  function switchKind(next: DiscoveryKind) {
    if (next === kind) return;
    request.current?.abort();
    setKind(next);
    setSelected(undefined);
    setItems([]);
    setContinuation(undefined);
    setStatus('idle');
  }

  async function search(append = false, target?: MapRegion) {
    const pageBounds = target ? discoveryBounds(target) : append ? nextPage?.bounds : bounds;
    if (!pageBounds) return;
    if (target) setDestination(target);
    else if (!append && searchRegion !== region) setDestination(searchRegion);
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setSelected(undefined);
    if (!append) { setItems([]); setContinuation(undefined); }
    setStatus('loading');
    try {
      const page = await discoverMap(pageBounds, kind, controller.signal, append ? nextPage?.cursor : undefined);
      if (controller.signal.aborted) return;
      setItems((previous) => {
        if (!append) return page.items;
        const existing = new Set(previous.map(({ id }) => id));
        return [...previous, ...page.items.filter(({ id }) => !existing.has(id))];
      });
      setContinuation(page.next ? { bounds: pageBounds, cursor: page.next } : undefined);
      setStatus(append || page.items.length ? 'ready' : 'empty');
    } catch {
      if (!controller.signal.aborted) setStatus('error');
    }
  }

  async function nearMe() {
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!mounted.current) return;
      if (!permission.granted) { Alert.alert(t.mapLocationDenied); return; }
      const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (mounted.current) setDestination({ latitude: coords.latitude, longitude: coords.longitude });
    } catch {
      if (mounted.current) Alert.alert(t.locationError);
    } finally {
      if (mounted.current) setLocating(false);
    }
  }

  function openDirections(feature: DiscoveryFeature) {
    const point = encodeURIComponent(feature.guide && feature.isArea ? `${feature.guide.reference}, ${feature.guide.country}`
      : `${feature.point.latitude},${feature.point.longitude}`);
    const url = feature.isArea ? `https://www.google.com/maps/search/?api=1&query=${point}`
      : `https://www.google.com/maps/dir/?api=1&destination=${point}${kind === 'trails' ? '&travelmode=walking' : ''}`;
    void Linking.openURL(url).catch(() => Alert.alert(t.actionError));
  }

  function showEurope() {
    request.current?.abort();
    setItems([]);
    setContinuation(undefined);
    setSelected(undefined);
    setStatus('idle');
    setDestination({ ...europeRegion });
  }

  const summary = status === 'loading' ? t.loading : status === 'error' ? t.discoverMapError
    : catalog.length && status !== 'ready' ? (kind === 'trails' ? t.europeTrailHint : t.europeFishingHint)
    : searchRegion !== region ? t.zoomDiscovery : status === 'empty' ? (kind === 'trails' ? t.noMappedTrails : t.noMappedFishing)
      : status === 'ready' ? (kind === 'trails' ? t.selectTrailLine : t.selectMapFeature) : '';

  return <View style={{ flex: 1, backgroundColor: p.bg }}>
    <FeedHeader safeTop align="left" title={t.discoverMap} leading={
      <IconButton name="chevron-back" label={t.back} align="start" color={p.accent}
        onPress={() => router.canGoBack() ? router.back() : router.replace('/map')} />} />
    <View style={[styles.columns, layout.controls]}>
      <Button label={t.mappedTrails} icon="footsteps-outline" stretch singleLine
        selected={kind === 'trails'} onPress={() => switchKind('trails')} />
      <Button label={t.mappedFishing} icon="fish-outline" stretch singleLine
        selected={kind === 'fishing'} onPress={() => switchKind('fishing')} />
      <Button label={t.europeMap} icon="globe-outline" stretch singleLine onPress={showEurope} />
    </View>
    <MapView initialRegion={initialRegion} movedTo={destination} onViewport={setRegion} externalAttribution compactLayers
      loading={status === 'loading'}
      pins={markerFeatures.map((feature) => ({ id: feature.id, ...(selected?.id === feature.id ? selected.point : feature.point), title: featureName(feature),
        color: feature.guide ? '#255A46' : pinColor }))}
      lines={items.flatMap((feature) => feature.lines.map((coordinates, index) => ({
        id: `${feature.id}-${index}`, coordinates, color: '#258457', selected: selected?.id === feature.id,
      })))} onSelect={(id) => setSelected(features.find((feature) => feature.id === id))}
      onMapPress={kind === 'trails' && items.length ? (point) => {
        setSelected(trailNearPoint(point, items, Math.min(0.003, 18 * region.longitudeDelta / Math.max(1, width))));
      } : undefined} />
    <View style={[layout.panel, { paddingBottom: Math.max(bottom, 12), backgroundColor: p.surface, borderColor: p.line }]}>
      {selected ? <ScrollView style={{ maxHeight: Math.min(240, height * 0.30) }} contentContainerStyle={layout.details}>
        <View style={styles.columns}>
          <Text accessibilityRole="header" numberOfLines={2} style={[styles.section, layout.title, { color: p.ink }]}>
            {featureName(selected)}
          </Text>
          <IconButton name="close-outline" label={t.closeMapFeature} onPress={() => setSelected(undefined)} />
        </View>
        {guide && <Text style={{ color: p.muted }}>{guide.reference} · {guide.country} · {guide.authority}</Text>}
        <Text style={{ color: p.muted }}>{guide ? (kind === 'trails' ? t.trailGuideWarning : t.fishingGuideWarning) : kind === 'trails' ? t.trailAccessWarning
          : selected.requiresPermit ? t.fishingMapPermit : t.fishingMapWarning}</Text>
        <View style={styles.columns}>
          <Button primary stretch label={selected.isArea ? t.viewMapArea : kind === 'trails' ? t.directionsToTrail : t.directions}
            icon="navigate-outline" onPress={() => openDirections(selected)} />
          {guide && <Button stretch label={kind === 'trails' ? t.trailOfficialInfo : t.fishingOfficialInfo} icon="open-outline" onPress={() => {
            void Linking.openURL(guide.url).catch(() => Alert.alert(t.actionError));
          }} />}
        </View>
        {guide && kind === 'trails' && <Button label={t.trailsAroundHere} icon="footsteps-outline" onPress={() => {
          void search(false, { ...initialRegion, ...selected.point });
        }} />}
      </ScrollView> : <>
        {!!summary && <View style={layout.status}>
          {status === 'empty' && <Ionicons name="map-outline" size={20} color={p.accent} />}
          <Text accessibilityLiveRegion="polite" style={{ flex: 1, color: status === 'error' ? p.danger : p.muted }}>{summary}</Text>
        </View>}
        {nextPage && <Button label={t.loadMoreTrails} icon="add-outline" disabled={status === 'loading'} onPress={() => void search(true)} />}
      </>}
      <Button label={locating ? t.loading : t.nearMe} icon="locate-outline" disabled={locating} onPress={() => void nearMe()} />
      <Button label={t.searchMapArea} icon="search-outline" primary disabled={!bounds || status === 'loading'}
        onPress={() => void search()} />
    </View>
  </View>;
}

const layout = StyleSheet.create({
  controls: { paddingHorizontal: 16, paddingVertical: 8 },
  panel: { paddingHorizontal: 16, paddingTop: 8, gap: 8, borderTopWidth: StyleSheet.hairlineWidth },
  details: { gap: 8 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { alignSelf: 'center', flex: 1 },
});
