import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnnualBars, monthName } from '../components/AnnualBars';
import { CategoryBadge } from '../components/CategoryPicker';
import { Header, IconButton, Notice, side, styles, usePalette } from '../components/ui';
import { useDiary } from '../db/useDiary';
import { locale, t } from '../i18n';
import { annualStats } from '../services/stats';

export default function Stats() {
  const router = useRouter();
  const p = usePalette();
  const inset = useSafeAreaInsets();
  const { items, error, load } = useDiary();
  const params = useLocalSearchParams<{ year?: string; month?: string }>();
  const [year, setYear] = useState(() => params.year && /^\d{4}$/.test(params.year) && Number(params.year) > 0
    ? Number(params.year) : new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | undefined>(() =>
    params.month && /^(?:[1-9]|1[0-2])$/.test(params.month) ? Number(params.month) - 1 : undefined);
  const stats = annualStats(items ?? [], year);
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' });
  const outingDate = (value: string) => Number.isFinite(Date.parse(value)) ? date.format(new Date(value)) : value;
  const hour = stats.bestTime;
  const datePrefix = selectedMonth == null ? undefined : `${String(year).padStart(4, '0')}-${String(selectedMonth + 1).padStart(2, '0')}`;
  const monthOutings = datePrefix ? items?.filter((outing) => outing.date.startsWith(`${datePrefix}-`)) : undefined;
  function changeYear(delta: number) {
    const next = Math.max(1, Math.min(9999, year + delta));
    if (next === year) return;
    setSelectedMonth(undefined);
    setYear(next);
  }
  return <>
    <Header title={t.annual} back={() => router.back()} />
    <ScrollView style={styles.screen} contentInsetAdjustmentBehavior="never"
      contentContainerStyle={[styles.content, { paddingBottom: side + inset.bottom }]}>
      <View style={[styles.row, { justifyContent: 'space-between' }]}>
        <IconButton name="chevron-back" label={t.previousYear} onPress={() => changeYear(-1)} />
        <Text style={[styles.section, { color: p.ink }]}>{year}</Text>
        <IconButton name="chevron-forward" label={t.nextYear} onPress={() => changeYear(1)} />
      </View>
      {error ? <Notice message={t.loadError} retry={() => void load()} /> : !items ? <Notice message={t.loading} loading />
        : !stats.total && selectedMonth == null ? <Notice message={t.empty} /> : <>
          <Text style={[styles.section, { color: p.ink }]}>{t.byMonth}</Text>
          <View style={[layout.chart, { backgroundColor: p.field }]}>
            <AnnualBars counts={stats.months} active={selectedMonth} onSelect={setSelectedMonth} />
          </View>
          {selectedMonth != null && <View style={styles.group}>
            <Text accessibilityRole="header" style={[styles.section, { color: p.ink }]}>{monthName(selectedMonth)} · {year}</Text>
            {monthOutings?.length ? monthOutings.map((outing) => <Link key={outing.id}
              href={{ pathname: '/outing/[id]', params: { id: outing.id } }} asChild>
              <Pressable accessibilityRole="button" style={StyleSheet.flatten([layout.outing, { backgroundColor: p.field }])}>
                <View style={layout.copy}>
                  <Text style={{ color: p.ink, fontWeight: '700' }}>{outing.title}</Text>
                  <Text style={{ color: p.muted }}>{outingDate(outing.date)}</Text>
                </View>
                <CategoryBadge type={outing.type} />
              </Pressable>
            </Link>) : <Notice message={t.noOutingsInMonth} />}
          </View>}
          <View style={{ gap: 8 }}>
            {[
              [t.outings, stats.total], [t.catches, stats.catches], [t.totalKm, number.format(stats.distance)],
              [t.bestMonth, stats.bestMonth == null ? t.unavailable : monthName(stats.bestMonth)],
              [t.bestBait, stats.bestBait ?? t.unavailable],
              [t.bestTime, hour ? `${hour}:00–${hour}:59` : t.unavailable],
            ].map(([label, value]) => <View style={styles.metricRow} key={label}>
              <Text style={[styles.metricLabel, { color: p.muted }]}>{label}</Text>
              <Text style={[styles.metricValue, { color: p.ink }]}>{value}</Text>
          </View>)}
          </View>
        </>}
    </ScrollView>
  </>;
}

const layout = StyleSheet.create({
  chart: { padding: 8, borderRadius: 12 },
  outing: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12 },
  copy: { flex: 1, minWidth: 0, gap: 4 },
});
