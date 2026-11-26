import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { t } from '../i18n';
import { PressFeedback } from './PressFeedback';
import { usePalette } from './ui';

export function SampleDataBanner({ onDelete, inset = 16 }: { onDelete: () => void; inset?: number }) {
  const p = usePalette();
  return <View style={[layout.banner, { backgroundColor: p.field, marginHorizontal: inset }]}>
    <Ionicons name="information-circle-outline" size={18} color={p.accent} />
    <Text style={[layout.label, { color: p.muted }]}>{t.sampleData}</Text>
    <PressFeedback accessibilityRole="button" accessibilityLabel={t.deleteSamples} onPress={onDelete} style={layout.action}>
      <Text style={{ color: p.accent, fontWeight: '700' }}>{t.delete}</Text>
    </PressFeedback>
  </View>;
}

const layout = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', paddingLeft: 12, gap: 8, borderRadius: 12, marginVertical: 6 },
  label: { flex: 1, minWidth: 0, fontSize: 13 },
  action: { minHeight: 44, minWidth: 44, paddingHorizontal: 12, justifyContent: 'center' },
});
