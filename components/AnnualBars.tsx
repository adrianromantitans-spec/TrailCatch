import { useEffect, useRef, useState } from 'react';
import type { ComponentRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { PressFeedback as Pressable } from './PressFeedback';
import { formatDiaryCount, locale } from '../i18n';
import { usePalette } from './ui';

const monthFormats = {
  narrow: new Intl.DateTimeFormat(locale, { month: 'narrow', timeZone: 'UTC' }),
  long: new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }),
};
const countFormatter = new Intl.NumberFormat(locale);

export function monthName(month: number, style: keyof typeof monthFormats = 'long') {
  return monthFormats[style].format(new Date(Date.UTC(2024, month, 1)));
}

export function AnnualBars({ counts, active, onSelect }: {
  counts: number[]; active?: number; onSelect: (month: number) => void;
}) {
  const p = usePalette();
  const peak = Math.max(1, ...counts);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const [width, setWidth] = useState(0);
  const columnWidth = Math.max(44, width / counts.length);
  useEffect(() => {
    if (active == null || !width) return;
    const max = Math.max(0, columnWidth * counts.length - width);
    scroll.current?.scrollTo({ x: Math.min(max, Math.max(0, (active + 0.5) * columnWidth - width / 2)), animated: false });
  }, [active, columnWidth, counts.length, width]);
  return <ScrollView ref={scroll} horizontal onLayout={({ nativeEvent }) => setWidth(nativeEvent.layout.width)}
    contentContainerStyle={layout.row}>
    {counts.map((count, month) => <Pressable key={month} accessibilityRole="button"
      accessibilityLabel={`${monthName(month)}, ${formatDiaryCount(count, 'outings')}`}
      accessibilityState={{ selected: active === month }} onPress={() => onSelect(month)} style={[layout.column, { width: columnWidth }]}>
      {active === month && <Text accessible={false} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}
        maxFontSizeMultiplier={1.25} style={[layout.count, { color: p.accent }]}>{countFormatter.format(count)}</Text>}
      <View style={[layout.bar, { height: 4 + 40 * count / peak,
        backgroundColor: active === month ? p.accent : count ? '#74A78D' : p.line }]} />
      <Text numberOfLines={1} maxFontSizeMultiplier={1.25} style={[layout.label,
        { color: active === month ? p.accent : p.muted }, active === month && layout.active]}>{monthName(month, 'narrow')}</Text>
    </Pressable>)}
  </ScrollView>;
}

const layout = StyleSheet.create({
  row: { flexDirection: 'row' },
  column: { minHeight: 72, justifyContent: 'flex-end', alignItems: 'stretch', paddingHorizontal: 2 },
  count: { textAlign: 'center', fontSize: 10, fontWeight: '700', marginBottom: 3 },
  bar: { borderRadius: 4, alignSelf: 'center', width: '72%' },
  label: { textAlign: 'center', fontSize: 11, marginTop: 3 },
  active: { fontWeight: '700' },
});
