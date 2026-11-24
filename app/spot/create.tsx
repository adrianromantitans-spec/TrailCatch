import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CategoryPicker } from '../../components/CategoryPicker';
import { MapView } from '../../components/MapView';
import { Button, Field, Header, Notice, side, styles, usePalette } from '../../components/ui';
import type { OutingType, Photo, Point } from '../../db/model';
import { t } from '../../i18n';
import { backend, useSession } from '../../services/backend';
import { discardPhotos, photoSource, selectPhotos } from '../../services/photos';
import { saveSpot } from '../../services/spots';
import type { Difficulty, Visibility } from '../../services/spots';

export default function CreateSpot() {
  const router = useRouter();
  const p = usePalette();
  const { session } = useSession();
  const inset = useSafeAreaInsets();
  const [type, setType] = useState<OutingType>('fishing');
  const [fields, setFields] = useState({ spotName: '', spotDescription: '', spotSpecies: '', season: '', directions: '' });
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [permit, setPermit] = useState(false);
  const [approximate, setApproximate] = useState(true);
  const [point, setPoint] = useState<Point>();
  const [movedTo, setMovedTo] = useState<Point>();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const files = useRef<Photo[]>([]);
  const active = useRef(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; discardPhotos(files.current); files.current = []; };
  }, []);

  async function place() {
    setBusy(true); setError('');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) { setError(t.locationDenied); return; }
      const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const selected = { latitude: coords.latitude, longitude: coords.longitude };
      setPoint(selected); setMovedTo(selected);
    } catch { setError(t.locationError); }
    finally { setBusy(false); }
  }

  async function photosFromLibrary() {
    setBusy(true); setError('');
    try {
      const selected = await selectPhotos(true, false);
      if (!active.current) { discardPhotos(selected.photos); return; }
      const accepted = selected.photos.slice(0, Math.max(0, 5 - files.current.length));
      discardPhotos(selected.photos.slice(accepted.length));
      files.current = [...files.current, ...accepted];
      setPhotos(files.current);
    } catch { setError(t.photosError); }
    finally { setBusy(false); }
  }

  async function submit() {
    if (!session || !point || !fields.spotName.trim()) return;
    setBusy(true); setError('');
    const owned = files.current;
    files.current = [];
    try {
      const id = await saveSpot(session.user.id, {
        name: fields.spotName.trim(), description: fields.spotDescription, type, difficulty,
        species: fields.spotSpecies.split(',').map((value) => value.trim()).filter(Boolean),
        season: fields.season, directions: fields.directions, requires_permit: permit, visibility,
        approximate_location: approximate, point, photos: owned,
      });
      discardPhotos(owned);
      if (active.current) router.replace({ pathname: '/spot/[id]', params: { id } });
    } catch {
      if (active.current) { files.current = owned; setError(t.spotError); } else discardPhotos(owned);
    } finally { if (active.current) setBusy(false); }
  }

  return <>
    <Header title={t.newSpot} back={() => router.back()} />
    {!backend ? <Notice message={t.backendUnavailable} /> : !session ? <View style={styles.content}>
      <Notice message={t.signInRequired} /><Button label={t.signIn} onPress={() => router.push('/account')} />
    </View> : <ScrollView style={styles.screen} keyboardShouldPersistTaps="handled"
      contentContainerStyle={[styles.content, { paddingBottom: inset.bottom + side }]}>
      <CategoryPicker value={type} onChange={setType} disabled={busy} />
      {(['spotName','spotDescription','spotSpecies','season','directions'] as const).map((field) =>
        <Field key={field} label={t[field]} value={fields[field]} multiline={field === 'spotDescription'}
          maxLength={field === 'spotName' ? 120 : undefined}
          onChangeText={(value) => setFields((previous) => ({ ...previous, [field]: value }))} />)}
      <Text style={[styles.fieldLabel, { color: p.muted }]}>{t.spotDifficulty}</Text>
      <View style={styles.row}>{(['easy','moderate','hard'] as const).map((choice) =>
        <Button label={t[choice]} key={choice} selected={difficulty === choice}
          onPress={() => setDifficulty(difficulty === choice ? null : choice)} />)}</View>
      <MapView point={point} movedTo={movedTo} onPick={setPoint} height={220} />
      <Button label={t.myLocation} icon="locate-outline" disabled={busy} onPress={() => void place()} />
      <Text style={[styles.fieldLabel, { color: p.muted }]}>{t.visibility}</Text>
      <View style={styles.row}>{(['private','friends','public'] as const).map((choice) =>
        <Button label={t[choice]} key={choice} selected={visibility === choice} onPress={() => setVisibility(choice)} />)}</View>
      {[[t.permit, permit, setPermit], [t.approximate, approximate, setApproximate]].map(([label, value, change]) =>
        <View key={String(label)} style={styles.metricRow}>
          <Text style={[styles.metricLabel, { color: p.ink }]}>{label as string}</Text>
          <Switch accessibilityLabel={label as string} value={value as boolean} onValueChange={change as (value: boolean) => void} />
        </View>)}
      {photos.length > 0 && <View style={styles.row}>{photos.map((photo, index) =>
        <View key={index} style={{ gap: 4 }}>
          <Image source={photoSource(photo)} style={{ width: 72, height: 72, borderRadius: 8 }} />
          <Button label={t.removePhoto} disabled={busy} onPress={() => {
            discardPhotos([photo]); files.current = files.current.filter((item) => item !== photo); setPhotos(files.current);
          }} />
        </View>)}</View>}
      <Button label={t.addMorePhotos} icon="images-outline" disabled={busy || photos.length >= 5} onPress={() => void photosFromLibrary()} />
      {!!error && <Text style={{ color: p.danger }} accessibilityLiveRegion="polite">{error}</Text>}
      <Button label={busy ? t.loading : t.saveSpot} primary disabled={busy || !point || !fields.spotName.trim()}
        onPress={() => void submit()} />
    </ScrollView>}
  </>;
}
