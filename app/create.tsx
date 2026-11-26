import { randomUUID } from 'expo-crypto';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, Keyboard, KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CatchBadge, catchDetails } from '../components/CatchBadge';
import { CatchEditor, draftNumber, invalidDraftNumber } from '../components/CatchEditor';
import type { CatchDraft } from '../components/CatchEditor';
import { CategoryPicker } from '../components/CategoryPicker';
import { MapView } from '../components/MapView';
import { OutingCamera } from '../components/OutingCamera';
import { useToast } from '../components/Toast';
import { Button, Field, Header, IconButton, side, styles, usePalette } from '../components/ui';
import { insertOuting } from '../db/diary';
import { localDate, OutingType, Photo, Point } from '../db/model';
import { t } from '../i18n';
import { discardPhotos, photoSource, removePhoto } from '../services/photos';
import type { PhotoBatch } from '../services/photos';

type Busy = 'save' | 'location';
type Capture = 'initial' | 'outing' | { catchKey: number };
const toCatch = ({ species, size, weight, bait, time, photo, weather, released }: CatchDraft) => ({
  species: species.trim(), size: draftNumber(size), weight: draftNumber(weight), bait: bait.trim(),
  time: time.trim(), photo, weather, released,
});
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
  const showToast = useToast();
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
  const [editing, setEditing] = useState<CatchDraft>();
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

  function discardDraftPhoto(photo: Photo) {
    discardPhotos([photo]);
    pending.current.delete(photo);
  }

  const originalCatch = editing && catches.find(({ key }) => key === editing.key);
  const cancelCatch = useCallback(() => {
    if (editing?.photo && editing.photo !== originalCatch?.photo) {
      discardPhotos([editing.photo]);
      pending.current.delete(editing.photo);
    }
    setEditing(undefined);
  }, [editing, originalCatch]);

  useFocusEffect(useCallback(() => {
    if (!editing || capture !== null) return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => { cancelCatch(); return true; });
    return () => listener.remove();
  }, [editing, capture, cancelCatch]));

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
      const [photo] = batch.photos;
      if (editing?.key === capture.catchKey && photo) {
        if (editing.photo && editing.photo !== originalCatch?.photo) discardDraftPhoto(editing.photo);
        pending.current.add(photo);
        setEditing({ ...editing, photo });
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
    if (type !== 'fishing' && Object.values(route).some(invalidDraftNumber)) {
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
        catches: catchItems.map(toCatch),
        route: type === 'fishing' ? undefined : {
          distance: draftNumber(route.distance), duration: draftNumber(route.duration), ascent: draftNumber(route.ascent),
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
    if (alive.current) {
      router.back();
      showToast(t.outingSaved);
    }
  }

  if (capture !== null) {
    return <OutingCamera onClose={closeCamera} onPhotos={acceptPhotos} multiple={typeof capture === 'string'}
      readLocation={typeof capture === 'string' && !point}
      preview={typeof capture === 'object' ? editing?.photo : photos[photos.length - 1]} />;
  }

  return <View style={styles.screen}>
    <KeyboardAvoidingView behavior="padding" accessibilityElementsHidden={!!editing} pointerEvents={editing ? 'none' : 'auto'}
      importantForAccessibility={editing ? 'no-hide-descendants' : 'auto'} style={[styles.screen, { backgroundColor: p.bg }]}>
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
          {catches.map((item) => {
            const entry = toCatch(item);
            const details = catchDetails(entry);
            return <View key={item.key} style={[formStyles.catchCard, { borderColor: p.line, backgroundColor: p.surface }]}>
              {item.photo && <Image source={photoSource(item.photo)} style={formStyles.catchPhoto} contentFit="cover" />}
              <View style={formStyles.catchCopy}>
                <CatchBadge capture={entry} />
                {!!details && <Text numberOfLines={2} style={{ color: p.muted }}>{details}</Text>}
              </View>
              <IconButton name="pencil-outline" label={t.editCatch} onPress={() => {
                if (busyRef.current) return;
                Keyboard.dismiss();
                setEditing(item);
              }} />
              <IconButton name="trash-outline" label={t.removeCatch} color={p.danger} onPress={() => {
                if (busyRef.current) return;
                if (item.photo) discardDraftPhoto(item.photo);
                setCatches((old) => old.filter(({ key }) => key !== item.key));
              }} />
            </View>;
          })}
          <Button label={t.addCatch} icon="add" disabled={!!busy} onPress={() => {
            Keyboard.dismiss();
            setEditing({ key: nextCatch.current++, species: '', size: '', weight: '', bait: '', time: '', released: false });
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
    </KeyboardAvoidingView>
    {editing && <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
      <CatchEditor key={editing.key} draft={editing} existing={!!originalCatch}
        onChange={(values) => setEditing((old) => old && { ...old, ...values })} onCancel={cancelCatch}
        onPhoto={() => openCamera({ catchKey: editing.key })}
        onRemovePhoto={() => {
          if (editing.photo && editing.photo !== originalCatch?.photo) discardDraftPhoto(editing.photo);
          setEditing({ ...editing, photo: undefined });
        }}
        onSave={() => {
          if (originalCatch?.photo && originalCatch.photo !== editing.photo) discardDraftPhoto(originalCatch.photo);
          setCatches((old) => originalCatch
            ? old.map((item) => item.key === editing.key ? editing : item) : [...old, editing]);
          Keyboard.dismiss();
          setEditing(undefined);
        }} />
    </View>}
  </View>;
}


const formStyles = StyleSheet.create({
  group: { gap: 16 },
  footer: { paddingTop: 12, paddingHorizontal: side, borderTopWidth: StyleSheet.hairlineWidth, gap: 8 },
  catchCard: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 8, borderRadius: 16, borderWidth: 1 },
  catchPhoto: { width: 40, height: 40, borderRadius: 8 },
  catchCopy: { flex: 1, minWidth: 0, gap: 4 },
});
