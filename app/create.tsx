import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';
import { Alert, Keyboard, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapView } from '../components/MapView';
import { Button, Field, Header, IconButton, side, styles, usePalette } from '../components/ui';
import { putOuting } from '../db/diary';
import { localDate, OutingType, outingTypes, Photo, Point } from '../db/model';
import { t } from '../i18n';
import { CameraPermissionError, discardPhotos, photoSource, removePhoto, selectPhotos } from '../services/photos';
import type { PhotoOrigin } from '../services/photos';

type Busy = 'save' | 'location' | 'photo';
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
  const [busy, setBusy] = useState<Busy>();
  const busyRef = useRef<Busy | undefined>(undefined);
  const [photoStatus, setPhotoStatus] = useState<{ catchKey?: number; message: string }>();
  const [error, setError] = useState<string>();
  const nextCatch = useRef(0);
  const pending = useRef(new Set<Photo>());
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      discardPhotos(pending.current);
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

  function begin(action: Busy) {
    if (busyRef.current) return false;
    busyRef.current = action;
    setBusy(action);
    return true;
  }

  function finish() {
    busyRef.current = undefined;
    if (alive.current) setBusy(undefined);
  }

  async function pick(origin: PhotoOrigin, catchItem?: CatchDraft) {
    if (!begin('photo')) return;
    const catchKey = catchItem?.key;
    setPhotoStatus({ catchKey, message: t.addingPhotos });
    Keyboard.dismiss();
    try {
      const picked = await selectPhotos(origin, !catchItem);
      if (!alive.current) {
        discardPhotos(picked);
        return;
      }
      setPhotoStatus(undefined);
      if (!picked.length) return;
      picked.forEach((item) => pending.current.add(item));
      if (catchItem) {
        if (catchItem.photo) {
          discardPhotos([catchItem.photo]);
          pending.current.delete(catchItem.photo);
        }
        updateCatch(catchItem.key, { photo: picked[0] });
      } else {
        setPhotos((old) => [...old, ...picked]);
      }
    } catch (error) {
      if (!alive.current) return;
      if (error instanceof CameraPermissionError) {
        setPhotoStatus(undefined);
        Alert.alert(t.cameraDenied, undefined, [
          { text: t.cancel, style: 'cancel' },
          { text: t.settings, onPress: () => void Linking.openSettings().catch(() => Alert.alert(t.cameraDenied)) },
        ]);
      } else {
        setPhotoStatus({ catchKey, message: origin === 'camera' ? t.cameraError : t.photosError });
      }
    } finally {
      finish();
    }
  }

  async function locate() {
    if (!begin('location')) return;
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
      finish();
    }
  }

  async function save() {
    if (busyRef.current) return;
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
    if (!begin('save')) return;
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
      } else discardPhotos(kept);
      finish();
      return;
    }
    if (type === 'hike') discardPhotos(catches.flatMap(({ photo }) => photo ? [photo] : []));
    if (alive.current) router.back();
  }

  function thumbnail(photo: Photo, onRemove: () => void) {
    return <View key={'uri' in photo ? photo.uri : photo.sample}>
      <Image source={photoSource(photo)} style={{ width: 88, height: 88, borderRadius: 12 }} />
      <View style={{ position: 'absolute', top: 4, right: 4, backgroundColor: p.glassSolid, borderRadius: 22 }}>
        <IconButton name="close" label={t.removePhoto} onPress={() => {
          if (busy) return;
          try { onRemove(); } catch { Alert.alert(t.deleteError); }
        }} />
      </View>
    </View>;
  }

  function photoControls(catchItem?: CatchDraft) {
    const status = photoStatus?.catchKey === catchItem?.key ? photoStatus?.message : undefined;
    return <>
      <View style={styles.columns}>
        <Button label={t.gallery} icon="images-outline" stretch stacked disabled={!!busy} onPress={() => void pick('library', catchItem)} />
        <Button label={t.camera} icon="camera-outline" stretch stacked disabled={!!busy} onPress={() => void pick('camera', catchItem)} />
      </View>
      {status && <Text accessibilityLiveRegion="polite" style={{ color: busy === 'photo' ? p.muted : p.danger }}>{status}</Text>}
    </>;
  }

  return <>
    <Header title={t.create} back={() => router.back()} />
    <ScrollView className="flex-1" keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets
      contentInsetAdjustmentBehavior="never"
      contentContainerStyle={[styles.content, { gap: 24, paddingBottom: inset.bottom + side }]}>
      <View style={formStyles.group}>
        <Text style={[styles.section, { color: p.ink }]}>{t.photos}</Text>
        {photoControls()}
        {photos.length > 0 && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {photos.map((photo) => thumbnail(photo, () => {
            remove(photo);
            setPhotos((old) => old.filter((item) => item !== photo));
          }))}
        </ScrollView>}
      </View>
      <View style={formStyles.group}>
        <View accessibilityRole="radiogroup" accessibilityLabel={t.type}
          style={[formStyles.segmented, { backgroundColor: p.soft, borderColor: p.line }]}>
          {outingTypes.map((item) => {
            const selected = type === item;
            const foreground = selected ? (p.dark ? '#12251B' : '#FFFFFF') : p.ink;
            return (
              <Pressable key={item} accessibilityRole="radio" accessibilityState={{ checked: selected, disabled: !!busy }}
                disabled={!!busy} onPress={() => setType(item)}
                style={({ pressed }) => [formStyles.segment, {
                  backgroundColor: selected ? p.accent : 'transparent', opacity: pressed ? 0.7 : 1,
                }]}>
                <Text style={[formStyles.segmentLabel, { color: foreground }]}>{t[item]}</Text>
              </Pressable>
            );
          })}
        </View>
        <Field label={t.title} value={title} onChangeText={setTitle} />
        <Field label={t.date} value={date} onChangeText={setDate} placeholder={t.dateHint} autoCapitalize="none" maxLength={10} />
        <Field label={t.notes} value={notes} onChangeText={setNotes} multiline />
      </View>
      <View style={formStyles.group}>
        <View style={{ gap: 4 }}>
          <Text style={[styles.section, { color: p.ink }]}>{t.location}</Text>
          <Text style={{ color: p.muted }}>{t.pickPoint}</Text>
        </View>
        <MapView point={point} movedTo={movedTo} onPick={setPoint} height={200} />
        <Button label={busy === 'location' ? t.loading : t.myLocation} icon="locate-outline" singleLine disabled={!!busy} onPress={() => void locate()} />
      </View>
      {type !== 'hike' && <View style={formStyles.group}>
        <Text style={[styles.section, { color: p.ink }]}>{t.catches}</Text>
        {catches.map((item) => <View key={item.key} style={[formStyles.catchCard, { borderColor: p.line, backgroundColor: p.surface }]}>
          {(['species', 'size', 'weight', 'bait', 'time'] as const).map((field) => <Field key={field}
            label={t[field]} value={item[field]} onChangeText={(value) => updateCatch(item.key, { [field]: value })}
            keyboardType={field === 'size' || field === 'weight' ? 'decimal-pad' : 'default'} />)}
          <Text style={{ color: p.muted, fontWeight: '600' }}>{t.photo}</Text>
          {photoControls(item)}
          {item.photo && thumbnail(item.photo, () => { remove(item.photo!); updateCatch(item.key, { photo: undefined }); })}
          <Button label={t.removeCatch} danger disabled={!!busy} onPress={() => {
            if (item.photo) {
              discardPhotos([item.photo]);
              pending.current.delete(item.photo);
            }
            setCatches((old) => old.filter(({ key }) => key !== item.key));
          }} />
        </View>)}
        <Button label={t.addCatch} icon="add" disabled={!!busy} onPress={() => {
          const key = nextCatch.current++;
          setCatches((old) => [...old, { key, species: '', size: '', weight: '', bait: '', time: '' }]);
        }} />
      </View>}
      {type !== 'fishing' && <View style={formStyles.group}>
        <Text style={[styles.section, { color: p.ink }]}>{t.hike}</Text>
        {(['distance', 'duration', 'ascent'] as const).map((field) => <Field key={field} label={t[field]}
          value={route[field]} keyboardType="decimal-pad" onChangeText={(value) => setRoute((old) => ({ ...old, [field]: value }))} />)}
      </View>}
      {error && <Text accessibilityLiveRegion="polite" style={{ color: p.danger }}>{error}</Text>}
      <Button label={busy === 'save' ? t.saving : t.save} primary disabled={!!busy} onPress={() => void save()} />
    </ScrollView>
  </>;
}


const formStyles = StyleSheet.create({
  group: { gap: 16 },
  segmented: { flexDirection: 'row', padding: 4, gap: 4, borderWidth: 1, borderRadius: 14 },
  segment: { flex: 1, minWidth: 0, minHeight: 44, borderRadius: 10, paddingHorizontal: 4, paddingVertical: 8,
    alignItems: 'center', justifyContent: 'center' },
  segmentLabel: { textAlign: 'center', fontWeight: '700', fontSize: 13 },
  catchCard: { gap: 16, padding: 16, borderRadius: 16, borderWidth: 1 },
});
