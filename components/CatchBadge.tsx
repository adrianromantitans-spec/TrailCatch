import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import type { Catch, CatchSummary } from '../db/model';
import { locale, t } from '../i18n';
import { usePalette } from './ui';

const measurement = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });

export function CatchBadge({ capture }: { capture: CatchSummary }) {
  const p = usePalette();
  const size = typeof capture.size === 'number' && Number.isFinite(capture.size)
    ? ` · ${measurement.format(capture.size)} ${t.units.cm}` : '';
  return <View style={[layout.badge, { backgroundColor: p.soft }]}>
    <Ionicons name="fish-outline" size={15} color={p.accent} />
    <Text style={[layout.label, { color: p.accent }]}>{`${capture.species || t.species}${size}`}</Text>
  </View>;
}

export function CatchBadges({ catches }: { catches?: readonly CatchSummary[] }) {
  if (!catches?.length) return null;
  return <View style={layout.badges}>
    {catches.map((capture, index) => <CatchBadge key={index} capture={capture} />)}
  </View>;
}

export function catchDetails(capture: Catch) {
  const { weight } = capture;
  return [
    typeof weight === 'number' && Number.isFinite(weight) ? `${measurement.format(weight)} ${t.units.kg}` : undefined,
    capture.bait, capture.time,
    capture.weather ? t[capture.weather] : undefined,
    capture.released === true ? t.catchReleased : capture.released === false ? t.catchKept : undefined,
  ].filter(Boolean).join(' · ');
}

const layout = StyleSheet.create({
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: { flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'center', maxWidth: '100%',
    paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10, gap: 5 },
  label: { flexShrink: 1, fontSize: 13, fontWeight: '600' },
});
