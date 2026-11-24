import { randomUUID } from 'expo-crypto';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, Keyboard, KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CategoryPicker } from '../components/CategoryPicker';
import { MapView } from '../components/MapView';
import { OutingCamera } from '../components/OutingCamera';
import { Button, Field, Header, IconButton, side, styles, usePalette } from '../components/ui';
import { insertOuting } from '../db/diary';
import { localDate, OutingType, Photo, Point } from '../db/model';
import { t } from '../i18n';
import { discardPhotos, photoSource, removePhoto } from '../services/photos';
import type { PhotoBatch } from '../services/photos';

type Busy = 'save' | 'location';
type Capture = 'initial' | 'outing' | { catchKey: number };
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

function OutingThumbnail({ photo, disabled, onRemove }: { photo: Photo; disabled: boolean; onRemove: () => void }) {
  const p = usePalette();
  return <View>
    <Image source={photoSource(photo)} style={{ width: 88, height: 88, borderRadius: 12 }} />
    <View style={{ position: 'absolute', top: 4, right: 4, backgroundColor: p.glassSolid, borderRadius: 22 }}>
      <IconButton name="close" label={t.removePhoto} onPress={() => {
        if (disabled) return;
        try { onRemove(); } catch { Alert.alert(t.deleteError); }
      }} />
    </View>
  </View>;
}

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
  const pointChosen = useRef(false);
  const locationAttempt = useRef(0);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [catches, setCatches] = useState<CatchDraft[]>([]);
  const [route, setRoute] = useState({ distance: '', duration: '', ascent: '' });
  const [busy, setBusy] = useState<Busy>();
  const busyRef = useRef<Busy | undefined>(undefined);
  const [capture, setCapture] = useState<Capture | null>('initial');
  const [locationMessage, setLocationMessage] = useState<string>();
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

  function choosePoint(value: Point, recenter: boolean) {
    pointChosen.current = true;
    setLocationMessage(undefined);
    setPoint(value);
    if (recenter) setMovedTo(value);
  }

  async function locate(automatic = false) {
    if (automatic && pointChosen.current) return;
    if (!automatic && !begin('location')) return;
    const attempt = ++locationAttempt.current;
    if (!automatic) setLocationMessage(undefined);
    try {
      const permission = automatic
        ? await Location.getForegroundPermissionsAsync()
        : await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        if (!automatic && alive.current) setLocationMessage(t.locationDenied);
        return;
      }
      const position = await Location.getLastKnownPositionAsync({ maxAge: 120000, requiredAccuracy: 100 })
        ?? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (!alive.current || attempt !== locationAttempt.current || (automatic && pointChosen.current)) return;
      const { latitude, longitude } = position.coords;
      choosePoint({ latitude, longitude }, true);
    } catch {
      if (!automatic && alive.current && attempt === locationAttempt.current) setLocationMessage(t.locationError);
    } finally {
      if (!automatic) finish();
    }
  }

  const closeCamera = useCallback(() => {
    if (capture === 'initial') router.back();
    else setCapture(null);
  }, [capture, router]);

  useFocusEffect(useCallback(() => {
    if (capture === null || capture === 'initial') return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      closeCamera();
      return true;
    });
    return () => listener.remove();
  }, [capture, closeCamera]));

  function openCamera(target: Capture) {
    if (busyRef.current) return;
    Keyboard.dismiss();
    setCapture(target);
  }

  function acceptPhotos(batch: PhotoBatch) {
    if (!capture || !alive.current) {
      discardPhotos(batch.photos);
      return;
    }
    if (typeof capture === 'object') {
      const draft = catches.find(({ key }) => key === capture.catchKey);
      const [photo] = batch.photos;
      if (draft && photo) {
        if (draft.photo) {
          discardPhotos([draft.photo]);
          pending.current.delete(draft.photo);
        }
        pending.current.add(photo);
        updateCatch(draft.key, { photo });
        discardPhotos(batch.photos.slice(1));
      } else discardPhotos(batch.photos);
    } else {
      batch.photos.forEach((photo) => pending.current.add(photo));
      setPhotos((old) => [...old, ...batch.photos]);
      if (!pointChosen.current) {
        if (batch.point) choosePoint(batch.point, true);
        else if (capture === 'initial') void locate(true);
      }
    }
    setCapture(null);
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
      await insertOuting(db, {
        id: randomUUID(), title: title.trim(), date: day,
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

  if (capture !== null) {
    const catchTarget = typeof capture === 'object' ? catches.find(({ key }) => key === capture.catchKey) : undefined;
    return <OutingCamera onClose={closeCamera} onPhotos={acceptPhotos} multiple={typeof capture === 'string'}
      readLocation={typeof capture === 'string' && !point}
      preview={typeof capture === 'object' ? catchTarget?.photo : photos[photos.length - 1]} />;
  }

  return <KeyboardAvoidingView behavior="padding" style={[styles.screen, { backgroundColor: p.bg }]}>
    <Header title={t.create} back={() => router.back()} />
    <ScrollView className="flex-1" keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="never"
      contentContainerStyle={[styles.content, { gap: 24 }]}>
      <View style={formStyles.group}>
        <Text style={[styles.section, { color: p.ink }]}>{t.photos}</Text>
        {photos.length > 0 && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {photos.map((photo) => <OutingThumbnail key={'uri' in photo ? photo.uri : photo.sample} photo={photo}
            disabled={!!busy} onRemove={() => {
              remove(photo);
              setPhotos((old) => old.filter((item) => item !== photo));
            }} />)}
        </ScrollView>}
        <Button label={t.addMorePhotos} icon="add" dashed singleLine disabled={!!busy} onPress={() => openCamera('outing')} />
      </View>
      <View style={formStyles.group}>
        <CategoryPicker value={type} onChange={setType} disabled={!!busy} />
        <Field label={t.title} value={title} onChangeText={setTitle} />
        <Field label={t.date} value={date} onChangeText={setDate} placeholder={t.dateHint} autoCapitalize="none" maxLength={10} />
        <Field label={t.notes} value={notes} onChangeText={setNotes} multiline />
      </View>
      <View style={formStyles.group}>
        <View style={{ gap: 4 }}>
          <Text style={[styles.section, { color: p.ink }]}>{t.location}</Text>
          <Text style={{ color: p.muted }}>{t.pickPoint}</Text>
        </View>
        <MapView point={point} movedTo={movedTo} onPick={(value) => { locationAttempt.current++; choosePoint(value, false); }} height={200} />
        <Button label={busy === 'location' ? t.loading : t.myLocation} icon="locate-outline" singleLine disabled={!!busy} onPress={() => void locate()} />
        {locationMessage && <Text accessibilityLiveRegion="polite" style={{ color: p.danger }}>{locationMessage}</Text>}
      </View>
      {type !== 'hike' && <View style={formStyles.group}>
        <Text style={[styles.section, { color: p.ink }]}>{t.catches}</Text>
        {catches.map((item) => <View key={item.key} style={[formStyles.catchCard, { borderColor: p.line, backgroundColor: p.surface }]}>
          {(['species', 'size', 'weight', 'bait', 'time'] as const).map((field) => <Field key={field}
            label={t[field]} value={item[field]} onChangeText={(value) => updateCatch(item.key, { [field]: value })}
            keyboardType={field === 'size' || field === 'weight' ? 'decimal-pad' : 'default'} />)}
          <Text style={{ color: p.muted, fontWeight: '600' }}>{t.photo}</Text>
          {item.photo && <OutingThumbnail photo={item.photo} disabled={!!busy}
            onRemove={() => { remove(item.photo!); updateCatch(item.key, { photo: undefined }); }} />}
          <Button label={item.photo ? t.changeCatchPhoto : t.addCatchPhoto} icon="add"
            disabled={!!busy} onPress={() => openCamera({ catchKey: item.key })} />
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
    </ScrollView>
    <View style={[formStyles.footer, { paddingBottom: Math.max(inset.bottom, 12),
      backgroundColor: p.bg, borderColor: p.line }]}>
      {error && <Text accessibilityLiveRegion="polite" style={{ color: p.danger }}>{error}</Text>}
      <Button label={busy === 'save' ? t.saving : t.save} primary disabled={!!busy} onPress={() => void save()} />
    </View>
  </KeyboardAvoidingView>;
}


const formStyles = StyleSheet.create({
  group: { gap: 16 },
  footer: { paddingTop: 12, paddingHorizontal: side, borderTopWidth: StyleSheet.hairlineWidth, gap: 8 },
  catchCard: { gap: 16, padding: 16, borderRadius: 16, borderWidth: 1 },
});
