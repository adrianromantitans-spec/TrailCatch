import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Header, IconButton, Notice, side, styles, usePalette } from '../components/ui';
import { useDiary } from '../db/useDiary';
import { locale, t } from '../i18n';
import { annualStats } from '../services/stats';

export default function Stats() {
  const router = useRouter();
  const p = usePalette();
  const inset = useSafeAreaInsets();
  const { items, error, load } = useDiary();
  const [year, setYear] = useState(new Date().getFullYear());
  const stats = annualStats(items ?? [], year);
  const max = Math.max(1, ...stats.months);
  const month = (index: number, style: 'short' | 'long') => new Intl.DateTimeFormat(locale, { month: style })
    .format(new Date(year, index, 1));
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const hour = stats.bestTime;
  return <>
    <Header title={t.annual} back={() => router.back()} />
    <ScrollView style={styles.screen} contentInsetAdjustmentBehavior="never"
      contentContainerStyle={[styles.content, { paddingBottom: side + inset.bottom }]}>
      <View style={[styles.row, { justifyContent: 'space-between' }]}>
        <IconButton name="chevron-back" label={t.previousYear} onPress={() => setYear(Math.max(1, year - 1))} />
        <Text style={[styles.section, { color: p.ink }]}>{year}</Text>
        <IconButton name="chevron-forward" label={t.nextYear} onPress={() => setYear(Math.min(9999, year + 1))} />
      </View>
      {error ? <Notice message={t.loadError} retry={() => void load()} /> : !items ? <Notice message={t.loading} loading />
        : !stats.total ? <Notice message={t.empty} /> : <>
          <View style={{ gap: 8 }}>
            {[
              [t.outings, stats.total], [t.catches, stats.catches], [t.totalKm, number.format(stats.distance)],
              [t.bestMonth, stats.bestMonth == null ? t.unavailable : month(stats.bestMonth, 'long')],
              [t.bestBait, stats.bestBait ?? t.unavailable],
              [t.bestTime, hour ? `${hour}:00–${hour}:59` : t.unavailable],
            ].map(([label, value]) => <View style={styles.metricRow} key={label}>
              <Text style={[styles.metricLabel, { color: p.muted }]}>{label}</Text>
              <Text style={[styles.metricValue, { color: p.ink }]}>{value}</Text>
          </View>)}
          </View>
          <Text style={[styles.section, { color: p.ink }]}>{t.byMonth}</Text>
          <View style={{ gap: 8 }}>
            {stats.months.map((value, index) => <View key={index} style={[styles.row, { flexWrap: 'nowrap' }]}>
              <Text style={{ color: p.muted, minWidth: 40 }}>{month(index, 'short')}</Text>
              <View style={{ flex: 1, height: 8, backgroundColor: p.soft, borderRadius: 4 }}>
                <View style={{ width: `${value / max * 100}%`, flex: 1, backgroundColor: p.water, borderRadius: 4 }} />
              </View>
              <Text style={{ color: p.ink, minWidth: 24, textAlign: 'right', fontVariant: ['tabular-nums'] }}>{value}</Text>
            </View>)}
          </View>
        </>}
    </ScrollView>
  </>;
}
