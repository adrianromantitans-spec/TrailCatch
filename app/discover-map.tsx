import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { initialMapRegion, MapView } from '../components/MapView';
import type { MapRegion } from '../components/MapView';
import { Button, Header, IconButton, side, styles, usePalette } from '../components/ui';
import type { Point } from '../db/model';
import { t } from '../i18n';
import { discoverMap, discoveryBounds, focusDiscoveryRegion } from '../services/mapDiscovery';
import type { DiscoveryFeature, DiscoveryKind } from '../services/mapDiscovery';

const initialRegion = { ...initialMapRegion, latitudeDelta: 0.075, longitudeDelta: 0.075 };

export default function DiscoverMap() {
  const router = useRouter();
  const p = usePalette();
  const { bottom } = useSafeAreaInsets();
  const [kind, setKind] = useState<DiscoveryKind>('trails');
  const [region, setRegion] = useState(initialRegion);
  const [destination, setDestination] = useState<Point & Partial<MapRegion>>();
  const [items, setItems] = useState<DiscoveryFeature[]>([]);
  const [selected, setSelected] = useState<DiscoveryFeature>();
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'empty' | 'error'>('idle');
  const [locating, setLocating] = useState(false);
  const request = useRef<AbortController>(null);
  const mounted = useRef(false);
  const searchRegion = focusDiscoveryRegion(region);
  const bounds = discoveryBounds(searchRegion);
  const pinColor = kind === 'trails' ? '#255A46' : '#28687C';
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
    setStatus('idle');
  }

  async function search() {
    if (!bounds) return;
    if (searchRegion !== region) setDestination(searchRegion);
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setSelected(undefined);
    setItems([]);
    setStatus('loading');
    try {
      const results = await discoverMap(bounds, kind, controller.signal);
      if (controller.signal.aborted) return;
      setItems(results);
      setStatus(results.length ? 'ready' : 'empty');
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
    const point = encodeURIComponent(`${feature.point.latitude},${feature.point.longitude}`);
    const url = feature.isArea ? `https://www.google.com/maps/search/?api=1&query=${point}`
      : `https://www.google.com/maps/dir/?api=1&destination=${point}${kind === 'trails' ? '&travelmode=walking' : ''}`;
    void Linking.openURL(url).catch(() => Alert.alert(t.actionError));
  }

  const summary = status === 'loading' ? t.loading : status === 'error' ? t.discoverMapError
    : searchRegion !== region ? t.zoomDiscovery : status === 'empty' ? (kind === 'trails' ? t.noMappedTrails : t.noMappedFishing)
      : status === 'ready' ? t.selectMapFeature : '';

  return <View style={{ flex: 1, backgroundColor: p.bg }}>
    <Header title={t.discoverMap} back={() => router.canGoBack() ? router.back() : router.replace('/map')} />
    <View style={[styles.columns, layout.controls]}>
      <Button label={t.mappedTrails} icon="footsteps-outline" stretch singleLine
        selected={kind === 'trails'} onPress={() => switchKind('trails')} />
      <Button label={t.mappedFishing} icon="fish-outline" stretch singleLine
        selected={kind === 'fishing'} onPress={() => switchKind('fishing')} />
    </View>
    <MapView initialRegion={initialRegion} movedTo={destination} onViewport={setRegion} externalAttribution
      pins={items.map((feature) => ({ id: feature.id, ...feature.point, title: featureName(feature), color: pinColor }))}
      lines={items.flatMap((feature) => feature.lines.map((coordinates, index) => ({
        id: `${feature.id}-${index}`, coordinates, color: '#258457', selected: selected?.id === feature.id,
      })))} onSelect={(id) => setSelected(items.find((feature) => feature.id === id))} />
    <View style={[layout.panel, { paddingBottom: Math.max(bottom, 12), backgroundColor: p.surface, borderColor: p.line }]}>
      {selected ? <>
        <View style={styles.columns}>
          <Text accessibilityRole="header" numberOfLines={2} style={[styles.section, layout.title, { color: p.ink }]}>
            {featureName(selected)}
          </Text>
          <IconButton name="close-outline" label={t.closeMapFeature} onPress={() => setSelected(undefined)} />
        </View>
        <Text style={{ color: p.muted }}>{kind === 'trails' ? t.trailAccessWarning
          : selected.requiresPermit ? t.fishingMapPermit : t.fishingMapWarning}</Text>
        <Button primary label={selected.isArea ? t.viewMapArea : kind === 'trails' ? t.directionsToTrail : t.directions}
          icon="navigate-outline" onPress={() => openDirections(selected)} />
      </> : <>
        {!!summary && <Text accessibilityLiveRegion="polite" style={{ color: status === 'error' ? p.danger : p.muted }}>{summary}</Text>}
        <View style={styles.columns}>
          <Button label={locating ? t.loading : t.nearMe} icon="locate-outline" disabled={locating} onPress={() => void nearMe()} />
          <Button label={t.searchMapArea} stretch icon="search-outline" disabled={!bounds || status === 'loading'}
            onPress={() => void search()} />
        </View>
      </>}
    </View>
  </View>;
}

const layout = StyleSheet.create({
  controls: { paddingHorizontal: side, paddingVertical: 8 },
  panel: { paddingHorizontal: side, paddingTop: 8, gap: 8, borderTopWidth: StyleSheet.hairlineWidth },
  title: { alignSelf: 'center', flex: 1 },
});
