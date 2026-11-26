import { Ionicons } from '@expo/vector-icons';
import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '../i18n';

export type IconName = keyof typeof Ionicons.glyphMap;
export const brandGreen = '#255A46';
export const onBrand = '#FFFFFF';

const light = {
  dark: false, bg: '#FFFFFF', surface: '#FFFFFF', ink: '#182723', muted: '#526762',
  line: '#D8E5DC', accent: brandGreen, soft: '#E7F1EB', field: '#F3F8F4', danger: '#9E383D',
  glass: '#FFFFFFD9', glassSolid: '#FFFFFFF5',
};
export const usePalette = () => light;
export const side = 20;

// Style callbacks must reach the native Pressable unchanged to keep the pressed and resting styles.
export function IconButton({ name, label, onPress, color, align, expanded, size = 44, iconSize = 23 }: {
  name: IconName; label: string; onPress: () => void; color?: string; align?: 'start' | 'end'; expanded?: boolean;
  size?: number; iconSize?: number;
}) {
  const p = usePalette();
  return (
    <Pressable cssInterop={false} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ expanded }}
      onPress={onPress} style={({ pressed }) => [styles.icon, { width: size, height: size, opacity: pressed ? 0.55 : 1,
        alignItems: align === 'start' ? 'flex-start' : align === 'end' ? 'flex-end' : 'center',
      }]}>
      <Ionicons name={name} size={iconSize} color={color ?? p.ink} />
    </Pressable>
  );
}

export function Header({ title, back, children }: { title: string; back?: () => void; children?: ReactNode }) {
  const p = usePalette();
  const inset = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: inset.top + 4, backgroundColor: p.bg, borderColor: p.line }]}>
      {back && <IconButton name="chevron-back" align="start" label={t.back} color={p.accent} onPress={back} />}
      <Text accessibilityRole="header" numberOfLines={2} style={[styles.headerText, { color: p.accent }]}>{title}</Text>
      {children}
    </View>
  );
}

export function Button({ label, onPress, icon, primary, danger, selected, disabled, stretch, singleLine, dashed }: {
  label: string; onPress: () => void; icon?: IconName; primary?: boolean; danger?: boolean;
  selected?: boolean; disabled?: boolean; stretch?: boolean; singleLine?: boolean; dashed?: boolean;
}) {
  const p = usePalette();
  const color = primary ? onBrand : disabled ? p.muted : danger ? p.danger : selected || dashed ? p.accent : p.ink;
  return (
    <Pressable cssInterop={false} accessibilityRole="button" accessibilityState={{ selected, disabled }} disabled={disabled}
      onPress={onPress} style={({ pressed }) => [styles.button, primary && styles.primaryButton, stretch && styles.stretchButton,
        dashed && styles.dashedButton, {
        backgroundColor: primary
          ? disabled ? '#465F55' : pressed ? '#1C4938' : brandGreen
          : selected || pressed || disabled ? p.soft : p.surface,
        borderColor: primary ? brandGreen : selected || dashed ? p.accent : p.line,
      }]}>
      {icon && <Ionicons name={icon} size={18} color={color} />}
      <Text numberOfLines={singleLine ? 1 : undefined} adjustsFontSizeToFit={singleLine}
        minimumFontScale={singleLine ? 0.8 : undefined} style={{ color, fontWeight: '600', flexShrink: 1, textAlign: 'center' }}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const p = usePalette();
  return (
    <View style={{ gap: 8 }}>
      <Text style={[styles.fieldLabel, { color: p.muted }]}>{label}</Text>
      <TextInput accessibilityLabel={label} keyboardAppearance="light" placeholderTextColor={p.muted} {...props}
        style={[styles.input, { color: p.ink, borderColor: p.line, backgroundColor: p.field },
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

export function EmptyState({ icon, message, action, onAction, disabled }: {
  icon: IconName; message: string; action: string; onAction: () => void; disabled?: boolean;
}) {
  const p = usePalette();
  return <View style={styles.notice}>
    <Ionicons name={icon} size={32} color={p.accent} />
    <Text accessibilityLiveRegion="polite" style={{ color: p.muted, textAlign: 'center' }}>{message}</Text>
    <Button label={action} onPress={onAction} disabled={disabled} />
  </View>;
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
  icon: { justifyContent: 'center', alignItems: 'center' },
  button: { minHeight: 44, borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' },
  primaryButton: { height: 52, borderRadius: 16 },
  dashedButton: { borderStyle: 'dashed', borderRadius: 16, alignSelf: 'stretch' },
  stretchButton: { flex: 1, minWidth: 0 },
  fieldLabel: { fontWeight: '600' },
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
