import { Pressable, StyleSheet, Text, View } from 'react-native';
import { locale, t } from '../i18n';
import { usePalette } from './ui';

const monthFormats = {
  narrow: new Intl.DateTimeFormat(locale, { month: 'narrow', timeZone: 'UTC' }),
  long: new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }),
};

export function monthName(month: number, style: keyof typeof monthFormats = 'long') {
  return monthFormats[style].format(new Date(Date.UTC(2024, month, 1)));
}

export function AnnualBars({ counts, active, onSelect }: {
  counts: number[]; active?: number; onSelect: (month: number) => void;
}) {
  const p = usePalette();
  const peak = Math.max(1, ...counts);
  return <View style={layout.row}>
    {counts.map((count, month) => <Pressable key={month} accessibilityRole="button"
      accessibilityLabel={`${monthName(month)}, ${count} ${t.outings.toLocaleLowerCase(locale)}`}
      accessibilityState={{ selected: active === month }} onPress={() => onSelect(month)} style={layout.column}>
      <View style={[layout.bar, { height: 3 + 42 * count / peak,
        backgroundColor: active === month ? p.accent : count ? '#74A78D' : p.line }]} />
      <Text numberOfLines={1} maxFontSizeMultiplier={1.25} style={[layout.label,
        { color: active === month ? p.accent : p.muted }, active === month && layout.active]}>{monthName(month, 'narrow')}</Text>
    </Pressable>)}
  </View>;
}

const layout = StyleSheet.create({
  row: { flexDirection: 'row' },
  column: { flex: 1, minWidth: 0, minHeight: 58, justifyContent: 'flex-end', alignItems: 'stretch', paddingHorizontal: 2 },
  bar: { borderRadius: 4 },
  label: { textAlign: 'center', fontSize: 11, marginTop: 3 },
  active: { fontWeight: '700' },
});
