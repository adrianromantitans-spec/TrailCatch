import { StyleSheet, Text } from 'react-native';
import { t } from '../i18n';
import { usePalette } from './ui';

export function EntryWordmark({ compact = false }: { compact?: boolean }) {
  const p = usePalette();

  return <Text accessibilityRole="header" accessibilityLabel={t.app} numberOfLines={1}
    adjustsFontSizeToFit minimumFontScale={0.75}
    style={[styles.name, compact && styles.compact, { color: p.ink }]}>
    {t.brandTrail}<Text style={{ color: p.accent }}>{t.brandCatch}</Text>
  </Text>;
}

const styles = StyleSheet.create({
  name: { fontSize: 48, fontWeight: '800', letterSpacing: -1, textAlign: 'center' },
  compact: { fontSize: 26, letterSpacing: -0.5 },
});
