import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import NativeMap, { Marker, Polyline, UrlTile } from 'react-native-maps';
import { Outing, Point } from '../db/model';
import { t } from '../i18n';
import { Button, side, styles as ui, usePalette } from './ui';

export type MapRegion = Point & { latitudeDelta: number; longitudeDelta: number };
type MapPin = Point & { id: string; title: string; color?: string };
type MapLine = { id: string; coordinates: Point[]; color: string; selected: boolean };

const layers = ['standard', 'satellite', 'terrain'] as const;
export const initialMapRegion = { latitude: 46.70, longitude: 23.42, latitudeDelta: 0.45, longitudeDelta: 0.45 };

export function MapView({ point, movedTo, outings = [], onSelect, onPick, onMapPress, height, bottomOffset = 8, emptyMessage,
  pins = [], lines = [], onViewport, externalAttribution, initialRegion = initialMapRegion }: {
  point?: Point; movedTo?: Point & Partial<MapRegion>; outings?: Outing[]; onSelect?: (id: string) => void;
  onPick?: (point: Point) => void; onMapPress?: (point: Point) => void; height?: number; bottomOffset?: number; emptyMessage?: string; pins?: MapPin[];
  lines?: MapLine[]; onViewport?: (region: MapRegion) => void; externalAttribution?: boolean; initialRegion?: MapRegion;
}) {
  const p = usePalette();
  const map = useRef<NativeMap>(null);
  const [layer, setLayer] = useState<typeof layers[number]>('standard');
  const destination = movedTo ?? outings[0]?.point;
  const latitude = destination?.latitude;
  const longitude = destination?.longitude;
  const center = point ?? destination;
  const latitudeDelta = movedTo?.latitudeDelta ?? 0.075;
  const longitudeDelta = movedTo?.longitudeDelta ?? 0.075;
  const onPress = onPick ?? onMapPress;
  useEffect(() => {
    if (latitude != null && longitude != null) {
      map.current?.animateToRegion({ latitude, longitude, latitudeDelta, longitudeDelta });
    }
  }, [movedTo, latitude, longitude, latitudeDelta, longitudeDelta]);

  return (
    <View style={[styles.frame, { backgroundColor: p.soft }, height ? { height, borderRadius: 16 } : { flex: 1 }]}>
      <NativeMap ref={map} style={StyleSheet.absoluteFill} mapType={layer}
        initialRegion={center ? { ...center, latitudeDelta: 0.075, longitudeDelta: 0.075 } : initialRegion}
        onPress={onPress ? ({ nativeEvent }) => {
          if (nativeEvent.action !== 'marker-press') onPress(nativeEvent.coordinate);
        } : undefined}
        onRegionChangeComplete={onViewport}
        mapPadding={height ? undefined : { top: 60, bottom: bottomOffset, left: 0, right: 0 }}
        toolbarEnabled={false} moveOnMarkerPress={false}>
        {layer === 'standard' && <UrlTile urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} />}
        {point && <Marker coordinate={point} pinColor="#255A46" />}
        {outings.map((outing) => <Marker key={outing.id} coordinate={outing.point} title={outing.title}
          pinColor={outing.type === 'hike' ? '#255A46' : '#28687C'} onPress={() => onSelect?.(outing.id)} />)}
        {lines.map((line) => <Polyline key={line.id} coordinates={line.coordinates} strokeColor={line.color}
          strokeWidth={line.selected ? 6 : 3.5} lineCap="round" lineJoin="round" />)}
        {pins.map((pin) => <Marker key={`spot-${pin.id}`} coordinate={pin} title={pin.title}
          pinColor={pin.color ?? '#255A46'} onPress={() => onSelect?.(pin.id)} />)}
      </NativeMap>
      {!onPick && <View style={[ui.columns, styles.layers, !height && { left: side, right: side }]} pointerEvents="box-none">
        {layers.map((item) => <Button key={item} label={t[item]} stretch selected={layer === item} onPress={() => setLayer(item)} />)}
      </View>}
      <View pointerEvents="none" style={[styles.overlays, {
        bottom: bottomOffset, left: height ? 8 : side, right: height ? 8 : side,
      }]}>
        {!!emptyMessage && <Text style={[styles.mapNote, { color: p.ink, backgroundColor: p.glassSolid }]}>{emptyMessage}</Text>}
        {(layer === 'standard' || externalAttribution) &&
          <Text style={[styles.mapNote, { color: p.ink, backgroundColor: p.glassSolid }]}>{t.osm}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden' },
  layers: { position: 'absolute', top: 12, left: 12, right: 12 },
  overlays: { position: 'absolute', alignItems: 'flex-start', gap: 4 },
  mapNote: { fontSize: 11, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4 },
});
