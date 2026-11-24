import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import NativeMap, { Marker, UrlTile } from 'react-native-maps';
import { Outing, Point } from '../db/model';
import { t } from '../i18n';
import { Button, styles as ui, usePalette } from './ui';

const layers = ['standard', 'satellite', 'terrain'] as const;
const initial = { latitude: 46.70, longitude: 23.42, latitudeDelta: 0.45, longitudeDelta: 0.45 };

export function MapView({ point, movedTo, outings = [], onSelect, onPick, height, footerInset = 0 }: {
  point?: Point; movedTo?: Point; outings?: Outing[]; onSelect?: (id: string) => void;
  onPick?: (point: Point) => void; height?: number; footerInset?: number;
}) {
  const p = usePalette();
  const map = useRef<NativeMap>(null);
  const [layer, setLayer] = useState<typeof layers[number]>('standard');
  const destination = movedTo ?? outings[0]?.point;
  const latitude = destination?.latitude;
  const longitude = destination?.longitude;
  const center = point ?? destination;
  useEffect(() => {
    if (latitude != null && longitude != null) {
      map.current?.animateToRegion({ latitude, longitude, latitudeDelta: 0.075, longitudeDelta: 0.075 });
    }
  }, [latitude, longitude]);

  return (
    <View style={[styles.frame, { backgroundColor: p.soft }, height ? { height, borderRadius: 15 } : { flex: 1 }]}>
      <NativeMap ref={map} style={StyleSheet.absoluteFill} mapType={layer}
        initialRegion={center ? { ...center, latitudeDelta: 0.075, longitudeDelta: 0.075 } : initial}
        onPress={onPick ? ({ nativeEvent }) => onPick(nativeEvent.coordinate) : undefined}
        toolbarEnabled={false} moveOnMarkerPress={false}>
        {layer === 'standard' && <UrlTile urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} />}
        {point && <Marker coordinate={point} pinColor="#255A46" />}
        {outings.map((outing) => <Marker key={outing.id} coordinate={outing.point} title={outing.title}
          pinColor={outing.type === 'hike' ? '#255A46' : '#28687C'} onPress={() => onSelect?.(outing.id)} />)}
      </NativeMap>
      {!onPick && <View style={[ui.row, styles.layers]} pointerEvents="box-none">
        {layers.map((item) => <Button key={item} label={t[item]} selected={layer === item} onPress={() => setLayer(item)} />)}
      </View>}
      {layer === 'standard' && <View pointerEvents="none" style={[styles.attribution,
        { backgroundColor: p.glassSolid, bottom: height ? 6 : 94 + footerInset }]}>
        <Text style={{ color: p.ink, fontSize: 11 }}>{t.osm}</Text>
      </View>}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden' },
  layers: { position: 'absolute', top: 10, left: 10, right: 10 },
  attribution: { position: 'absolute', left: 8, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
});
