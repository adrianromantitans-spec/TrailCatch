import { Ionicons } from '@expo/vector-icons';
import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, TextInputProps, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '../i18n';

export type IconName = keyof typeof Ionicons.glyphMap;
const light = {
  dark: false, bg: '#F9FAF7', surface: '#FFFFFF', ink: '#182723', muted: '#526762',
  line: '#DFE8E2', accent: '#255A46', water: '#28687C', soft: '#E7F1EB', danger: '#9E383D',
  glass: '#FFFFFFC7', glassSolid: '#FAFCF7F5',
};
const dark = {
  dark: true, bg: '#121A18', surface: '#1B2723', ink: '#F0F6F2', muted: '#AEC1B7',
  line: '#34473E', accent: '#9DD7B9', water: '#9AD6E8', soft: '#233F33', danger: '#FF9EA3',
  glass: '#1B2723B8', glassSolid: '#1B2723F5',
};
export const usePalette = () => useColorScheme() === 'dark' ? dark : light;
export const side = 20;

export function IconButton({ name, label, onPress, color, align }: {
  name: IconName; label: string; onPress: () => void; color?: string; align?: 'start' | 'end';
}) {
  const p = usePalette();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label}
      onPress={onPress} style={({ pressed }) => [styles.icon, { opacity: pressed ? 0.55 : 1,
        alignItems: align === 'start' ? 'flex-start' : align === 'end' ? 'flex-end' : 'center',
      }]}>
      <Ionicons name={name} size={23} color={color ?? p.ink} />
    </Pressable>
  );
}

export function Header({ title, back, children }: { title: string; back?: () => void; children?: ReactNode }) {
  const p = usePalette();
  const inset = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: inset.top + 4, backgroundColor: p.bg, borderColor: p.line }]}>
      {back && <IconButton name="chevron-back" align="start" label={t.back} onPress={back} />}
      <Text accessibilityRole="header" numberOfLines={2} style={[styles.headerText, { color: p.ink }]}>{title}</Text>
      {children}
    </View>
  );
}

export function Button({ label, onPress, icon, primary, danger, selected, disabled, stretch }: {
  label: string; onPress: () => void; icon?: IconName; primary?: boolean; danger?: boolean;
  selected?: boolean; disabled?: boolean; stretch?: boolean;
}) {
  const p = usePalette();
  const color = primary ? (p.dark ? '#12251B' : '#FFFFFF') : danger ? p.danger : selected ? p.accent : p.ink;
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected, disabled }} disabled={disabled}
      onPress={onPress} style={({ pressed }) => [styles.button, stretch && styles.stretchButton, {
        backgroundColor: primary ? p.accent : selected ? p.soft : p.surface,
        borderColor: selected ? p.accent : p.line, opacity: disabled || pressed ? 0.6 : 1,
      }]}>
      {icon && <Ionicons name={icon} size={18} color={color} />}
      <Text style={{ color, fontWeight: '600', flexShrink: 1, textAlign: 'center' }}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const p = usePalette();
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: p.muted, fontWeight: '600' }}>{label}</Text>
      <TextInput accessibilityLabel={label} placeholderTextColor={p.muted} {...props}
        style={[styles.input, { color: p.ink, borderColor: p.line, backgroundColor: p.surface },
          props.multiline && { minHeight: 90, textAlignVertical: 'top' }, props.style]} />
    </View>
  );
}

export function Notice({ message, loading, retry }: { message: string; loading?: boolean; retry?: () => void }) {
  const p = usePalette();
  return (
    <View style={styles.notice}>
      {loading && <ActivityIndicator color={p.accent} />}
      <Text accessibilityLiveRegion="polite" style={{ color: p.muted, textAlign: 'center' }}>{message}</Text>
      {retry && <Button label={t.retry} onPress={retry} />}
    </View>
  );
}

export function Avatar({ sample, size = 38 }: { sample?: boolean; size?: number }) {
  const p = usePalette();
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: p.soft }]}>
      <Ionicons name={sample ? 'leaf-outline' : 'person-outline'} size={Math.round(size * 0.52)} color={p.accent} />
    </View>
  );
}

export const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingBottom: 4, paddingHorizontal: side, borderBottomWidth: StyleSheet.hairlineWidth },
  headerText: { flex: 1, fontWeight: '800', fontSize: 23, letterSpacing: -0.6 },
  icon: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  button: { minHeight: 44, borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' },
  stretchButton: { flex: 1, minWidth: 0 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16 },
  notice: { padding: 24, minHeight: 120, alignItems: 'center', justifyContent: 'center', gap: 12 },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  screen: { flex: 1 },
  content: { padding: side, gap: 16 },
  group: { gap: 12 },
  columns: { flexDirection: 'row', alignItems: 'stretch', gap: 8 },
  section: { fontSize: 18, fontWeight: '700' },
  metricRow: { flexDirection: 'row', alignItems: 'baseline', gap: 12, minHeight: 24 },
  metricLabel: { flex: 1 },
  metricValue: { flexShrink: 1, maxWidth: '55%', textAlign: 'right', fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
});
