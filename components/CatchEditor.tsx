import { Image } from 'expo-image';
import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { catchWeatherOptions } from '../db/model';
import type { CatchWeather, Photo } from '../db/model';
import { locale, t } from '../i18n';
import { photoSource } from '../services/photos';
import { Button, Field, Header, IconButton, side, styles, usePalette } from './ui';

export type CatchDraft = {
  key: number; species: string; size: string; weight: string; bait: string; time: string;
  photo?: Photo; weather?: CatchWeather; released: boolean;
};

export const draftNumber = (raw: string) => raw.trim() ? Number(raw.trim().replace(',', '.')) : undefined;
export const invalidDraftNumber = (raw: string) => {
  const value = draftNumber(raw);
  return value !== undefined && (!Number.isFinite(value) || value < 0);
};

export function CatchEditor({ draft, existing, onChange, onCancel, onSave, onPhoto, onRemovePhoto }: {
  draft: CatchDraft; existing: boolean; onChange: (values: Partial<CatchDraft>) => void;
  onCancel: () => void; onSave: () => void; onPhoto: () => void; onRemovePhoto: () => void;
}) {
  const p = usePalette();
  const { bottom } = useSafeAreaInsets();
  const [error, setError] = useState<string>();
  const query = draft.species.trim().toLocaleLowerCase(locale);
  const suggestions = t.commonCatchSpecies.filter((name) => name.toLocaleLowerCase(locale).startsWith(query) && name.toLocaleLowerCase(locale) !== query);
  function submit() {
    if (!query) { setError(t.catchSpeciesRequired); return; }
    if (invalidDraftNumber(draft.size) || invalidDraftNumber(draft.weight) ||
        (draft.time.trim() && !/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.time.trim()))) {
      setError(t.invalidNumbers);
      return;
    }
    onSave();
  }
  return <KeyboardAvoidingView behavior="padding" style={[styles.screen, { backgroundColor: p.bg }]}>
    <Header title={existing ? t.editCatch : t.addCatch} back={onCancel} />
    <ScrollView style={styles.screen} keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="never"
      contentContainerStyle={styles.content}>
      <View style={styles.group}>
        <Text style={[styles.fieldLabel, { color: p.muted }]}>{t.photo} · {t.optionalField}</Text>
        {draft.photo && <View style={layout.photoFrame}>
          <Image source={photoSource(draft.photo)} style={StyleSheet.absoluteFill} contentFit="cover" />
          <View style={[layout.photoRemove, { backgroundColor: p.glassSolid }]}>
            <IconButton name="close" label={t.removePhoto} onPress={onRemovePhoto} />
          </View>
        </View>}
        <Button label={draft.photo ? t.changeCatchPhoto : t.addCatchPhoto} icon="camera-outline" onPress={onPhoto} />
      </View>
      <Field label={t.species} value={draft.species} maxLength={80} onChangeText={(species) => onChange({ species })} />
      {suggestions.length > 0 && <ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false}
        contentContainerStyle={layout.chips}>
        {suggestions.map((species) => <Button key={species} label={species} onPress={() => onChange({ species })} />)}
      </ScrollView>}
      <View style={styles.columns}>
        {(['size', 'weight'] as const).map((field) => <View key={field} style={layout.grow}>
          <Field label={t[field]} placeholder={t.optionalField} value={draft[field]} keyboardType="decimal-pad"
            onChangeText={(value) => onChange({ [field]: value })} />
        </View>)}
      </View>
      <Field label={t.bait} value={draft.bait} onChangeText={(bait) => onChange({ bait })} />
      <Field label={t.time} placeholder={t.optionalField} value={draft.time} maxLength={5} onChangeText={(time) => onChange({ time })} />
      <Text style={[styles.fieldLabel, { color: p.muted }]}>{t.catchWeather} · {t.optionalField}</Text>
      <View style={styles.row}>
        {catchWeatherOptions.map((weather) => <Button key={weather} label={t[weather]} selected={draft.weather === weather}
          onPress={() => onChange({ weather: draft.weather === weather ? undefined : weather })} />)}
      </View>
      <View style={layout.switchRow}>
        <Text style={{ color: p.ink, fontWeight: '600' }}>{draft.released ? t.catchReleased : t.catchKept}</Text>
        <Switch accessibilityLabel={t.catchReleased} value={draft.released} onValueChange={(released) => onChange({ released })}
          trackColor={{ true: p.accent }} />
      </View>
    </ScrollView>
    <View style={[layout.footer, { paddingBottom: Math.max(12, bottom), borderColor: p.line, backgroundColor: p.bg }]}>
      {error && <Text accessibilityLiveRegion="polite" style={{ color: p.danger }}>{error}</Text>}
      <Button label={t.saveCatch} primary onPress={submit} />
    </View>
  </KeyboardAvoidingView>;
}

const layout = StyleSheet.create({
  photoFrame: { width: 112, height: 112, borderRadius: 12, overflow: 'hidden' },
  photoRemove: { position: 'absolute', right: 4, top: 4, borderRadius: 22 },
  chips: { gap: 8 },
  grow: { flex: 1, minWidth: 0 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footer: { gap: 8, paddingHorizontal: side, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
});
