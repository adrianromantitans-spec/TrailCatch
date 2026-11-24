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
    <ScrollView contentContainerStyle={{ padding: side, gap: 19, paddingBottom: side + inset.bottom }}>
      <View style={[styles.row, { justifyContent: 'space-between' }]}>
        <IconButton name="chevron-back" label={t.previousYear} onPress={() => setYear(Math.max(1, year - 1))} />
        <Text style={[styles.section, { color: p.ink }]}>{year}</Text>
        <IconButton name="chevron-forward" label={t.nextYear} onPress={() => setYear(Math.min(9999, year + 1))} />
      </View>
      {error ? <Notice message={t.loadError} retry={() => void load()} /> : !items ? <Notice message={t.loading} loading />
        : !stats.total ? <Notice message={t.empty} /> : <>
          {[
            [t.outings, stats.total], [t.catches, stats.catches], [t.totalKm, number.format(stats.distance)],
            [t.bestMonth, stats.bestMonth == null ? t.unavailable : month(stats.bestMonth, 'long')],
            [t.bestBait, stats.bestBait ?? t.unavailable],
            [t.bestTime, hour ? `${hour}:00–${hour}:59` : t.unavailable],
          ].map(([label, value]) => <View style={[styles.row, { justifyContent: 'space-between' }]} key={label}>
            <Text style={{ color: p.muted }}>{label}</Text><Text style={{ color: p.ink, fontWeight: '700' }}>{value}</Text>
          </View>)}
          <Text style={[styles.section, { color: p.ink }]}>{t.byMonth}</Text>
          <View style={{ gap: 7 }}>
            {stats.months.map((value, index) => <View key={index} style={[styles.row, { flexWrap: 'nowrap' }]}>
              <Text style={{ color: p.muted, width: 40 }}>{month(index, 'short')}</Text>
              <View style={{ flex: 1, height: 9, backgroundColor: p.soft, borderRadius: 5 }}>
                <View style={{ width: `${value / max * 100}%`, flex: 1, backgroundColor: p.water, borderRadius: 5 }} />
              </View>
              <Text style={{ color: p.ink, minWidth: 18, textAlign: 'right' }}>{value}</Text>
            </View>)}
          </View>
        </>}
    </ScrollView>
  </>;
}
