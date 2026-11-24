import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapView } from '../components/MapView';
import { Button, Field, Header, IconButton, side, styles, usePalette } from '../components/ui';
import { putOuting } from '../db/diary';
import { localDate, OutingType, outingTypes, Photo, Point } from '../db/model';
import { t } from '../i18n';
import { photoSource, removePhoto, selectPhotos } from '../services/photos';

type CatchDraft = { key: number; species: string; size: string; weight: string; bait: string; time: string; photo?: Photo };
const number = (raw: string) => raw.trim() ? Number(raw.trim().replace(',', '.')) : undefined;
const invalid = (raw: string) => {
  const value = number(raw);
  return value !== undefined && (!Number.isFinite(value) || value < 0);
};
const validDate = (date: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(date);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === date;
};

export default function Create() {
  const p = usePalette();
  const inset = useSafeAreaInsets();
  const router = useRouter();
  const db = useSQLiteContext();
  const [type, setType] = useState<OutingType>('fishing');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(localDate);
  const [notes, setNotes] = useState('');
  const [point, setPoint] = useState<Point>();
  const [movedTo, setMovedTo] = useState<Point>();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [catches, setCatches] = useState<CatchDraft[]>([]);
  const [route, setRoute] = useState({ distance: '', duration: '', ascent: '' });
  const [busy, setBusy] = useState<'save' | 'location' | 'photo'>();
  const [error, setError] = useState<string>();
  const nextCatch = useRef(0);
  const pending = useRef(new Set<Photo>());
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      pending.current.forEach(removePhoto);
      pending.current.clear();
    };
  }, []);

  function remove(photo: Photo) {
    removePhoto(photo);
    pending.current.delete(photo);
  }

  function updateCatch(key: number, values: Partial<CatchDraft>) {
    setCatches((old) => old.map((item) => item.key === key ? { ...item, ...values } : item));
  }

  async function pick(catchItem?: CatchDraft) {
    setBusy('photo');
    setError(undefined);
    try {
      const picked = await selectPhotos(!catchItem);
      if (!alive.current) {
        picked.forEach(removePhoto);
        return;
      }
      picked.forEach((item) => pending.current.add(item));
      if (catchItem && picked[0]) {
        if (catchItem.photo) remove(catchItem.photo);
        updateCatch(catchItem.key, { photo: picked[0] });
      } else if (!catchItem) setPhotos((old) => [...old, ...picked]);
    } catch {
      if (alive.current) setError(t.photosError);
    } finally {
      if (alive.current) setBusy(undefined);
    }
  }

  async function locate() {
    setBusy('location');
    setError(undefined);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setError(t.locationDenied);
        return;
      }
      const { coords: { latitude, longitude } } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const value = { latitude, longitude };
      setPoint(value);
      setMovedTo(value);
    } catch {
      setError(t.locationError);
    } finally {
      setBusy(undefined);
    }
  }

  async function save() {
    const day = date.trim();
    if (!title.trim() || !validDate(day) || !point) {
      setError(t.required);
      return;
    }
    const catchItems = type === 'hike' ? [] : catches;
    if (catchItems.some((item) => invalid(item.size) || invalid(item.weight) ||
      (item.time.trim() !== '' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(item.time.trim()))) ||
      (type !== 'fishing' && Object.values(route).some(invalid))) {
      setError(t.invalidNumbers);
      return;
    }
    setBusy('save');
    setError(undefined);
    // Transfer ownership before saving so a system back gesture can't remove files during a write.
    const kept = pending.current;
    pending.current = new Set();
    try {
      await putOuting(db, {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, title: title.trim(), date: day,
        notes: notes.trim(), point, type, photos,
        catches: catchItems.map((item) => ({
          species: item.species.trim(), size: number(item.size), weight: number(item.weight),
          bait: item.bait.trim(), time: item.time.trim(), photo: item.photo,
        })),
        route: type === 'fishing' ? undefined : {
          distance: number(route.distance), duration: number(route.duration), ascent: number(route.ascent),
        },
        likes: 0, liked: false, saved: false, comments: [],
      });
    } catch {
      if (alive.current) {
        pending.current = kept;
        setError(t.saveError);
        setBusy(undefined);
      } else kept.forEach(removePhoto);
      return;
    }
    if (type === 'hike') {
      try { catches.forEach(({ photo }) => { if (photo) removePhoto(photo); }); }
      catch { if (alive.current) Alert.alert(t.deleteError); }
    }
    if (alive.current) router.back();
  }

  function thumbnail(photo: Photo, onRemove: () => void) {
    return <View key={'uri' in photo ? photo.uri : photo.sample}>
      <Image source={photoSource(photo)} style={{ width: 84, height: 84, borderRadius: 11 }} />
      <View style={{ position: 'absolute', top: 0, right: 0, backgroundColor: p.glassSolid, borderRadius: 21 }}>
        <IconButton name="close" label={t.removePhoto} onPress={() => {
          if (busy) return;
          try { onRemove(); } catch { Alert.alert(t.deleteError); }
        }} />
      </View>
    </View>;
  }

  return <>
    <Header title={t.create} back={() => router.back()} />
    <ScrollView className="flex-1" keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ gap: 14, padding: side, paddingBottom: inset.bottom + side }}>
      <View style={styles.row}>{outingTypes.map((item) =>
        <Button key={item} label={t[item]} selected={type === item} disabled={!!busy} onPress={() => setType(item)} />)}</View>
      <Field label={t.title} value={title} onChangeText={setTitle} />
      <Field label={t.date} value={date} onChangeText={setDate} placeholder={t.dateHint} autoCapitalize="none" maxLength={10} />
      <Text style={[styles.section, { color: p.ink }]}>{t.location}</Text>
      <Text style={{ color: p.muted }}>{t.pickPoint}</Text>
      <MapView point={point} movedTo={movedTo} onPick={setPoint} height={230} />
      <Button label={busy === 'location' ? t.loading : t.myLocation} icon="locate-outline" disabled={!!busy} onPress={() => void locate()} />
      <Field label={t.notes} value={notes} onChangeText={setNotes} multiline />
      <View style={styles.row}>
        {photos.map((photo) => thumbnail(photo, () => { remove(photo); setPhotos((old) => old.filter((item) => item !== photo)); }))}
      </View>
      <Button label={busy === 'photo' ? t.loading : t.photos} icon="images-outline" disabled={!!busy} onPress={() => void pick()} />
      {type !== 'hike' && <>
        <Text style={[styles.section, { color: p.ink }]}>{t.catches}</Text>
        {catches.map((item) => <View key={item.key} style={{ gap: 10, padding: 13, borderRadius: 15, borderWidth: 1, borderColor: p.line }}>
          {(['species', 'size', 'weight', 'bait', 'time'] as const).map((field) => <Field key={field}
            label={t[field]} value={item[field]} onChangeText={(value) => updateCatch(item.key, { [field]: value })}
            keyboardType={field === 'size' || field === 'weight' ? 'decimal-pad' : 'default'} />)}
          {item.photo && thumbnail(item.photo, () => { remove(item.photo!); updateCatch(item.key, { photo: undefined }); })}
          <Button label={t.photo} icon="image-outline" disabled={!!busy} onPress={() => void pick(item)} />
          <Button label={t.removeCatch} danger disabled={!!busy} onPress={() => {
            if (item.photo) remove(item.photo);
            setCatches((old) => old.filter(({ key }) => key !== item.key));
          }} />
        </View>)}
        <Button label={t.addCatch} icon="add" disabled={!!busy} onPress={() => {
          const key = nextCatch.current++;
          setCatches((old) => [...old, { key, species: '', size: '', weight: '', bait: '', time: '' }]);
        }} />
      </>}
      {type !== 'fishing' && <>
        <Text style={[styles.section, { color: p.ink }]}>{t.hike}</Text>
        {(['distance', 'duration', 'ascent'] as const).map((field) => <Field key={field} label={t[field]}
          value={route[field]} keyboardType="decimal-pad" onChangeText={(value) => setRoute((old) => ({ ...old, [field]: value }))} />)}
      </>}
      {error && <Text accessibilityLiveRegion="polite" style={{ color: p.danger }}>{error}</Text>}
      <Button label={busy === 'save' ? t.saving : t.save} primary disabled={!!busy} onPress={() => void save()} />
    </ScrollView>
  </>;
}
