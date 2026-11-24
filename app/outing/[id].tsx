import { randomUUID } from 'expo-crypto';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ComponentRef, useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Conditions } from '../../components/Conditions';
import { MapView } from '../../components/MapView';
import { Button, Field, Header, Notice, side, styles, usePalette } from '../../components/ui';
import { getOuting, updateOuting } from '../../db/diary';
import { Outing, photoList } from '../../db/model';
import { relativeDate, t } from '../../i18n';
import { photoSource } from '../../services/photos';

export default function Detail() {
  const { id, comments } = useLocalSearchParams<{ id: string; comments?: string }>();
  const db = useSQLiteContext();
  const router = useRouter();
  const inset = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const galleryWidth = Math.min(320, Math.round((width - side * 2) * 0.8));
  const p = usePalette();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const [item, setItem] = useState<Outing | null>();
  const [error, setError] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(false);
  const load = useCallback(async () => {
    try { setItem(await getOuting(db, id)); setError(false); } catch { setError(true); }
  }, [db, id]);
  useEffect(() => { void load(); }, [load]);

  async function comment() {
    if (!text.trim() || sending) return;
    setSending(true);
    setSendError(false);
    try {
      const newComment = { id: randomUUID(), text: text.trim() };
      await updateOuting(db, id, (old) => ({ ...old, comments: [...old.comments, newComment] }));
      setText('');
      await load();
    } catch { setSendError(true); }
    finally { setSending(false); }
  }

  const photos = item ? photoList(item) : [];
  return <>
    <Header title={item?.title ?? t.outings} back={() => router.back()} />
    {error ? <Notice message={t.loadError} retry={() => void load()} /> : !item
      ? <Notice loading={item === undefined} message={item === null ? t.noResults : t.loading} />
      : <ScrollView ref={scroll} style={styles.screen} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets
        contentInsetAdjustmentBehavior="never" contentContainerStyle={[styles.content, { paddingBottom: inset.bottom + side }]}>
        <Text style={{ color: p.muted }}>{t[item.type]} · {relativeDate(item.date)}</Text>
        {photos.length > 0 && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
          {photos.map((photo, index) => <Image key={`photo-${item.id}-${index}`} source={photoSource(photo)} transition={150}
            style={{ width: galleryWidth, aspectRatio: 4 / 5, borderRadius: 12, backgroundColor: p.soft }} />)}
        </ScrollView>}
        {item.notes ? <Text style={{ color: p.ink, fontSize: 16 }}>{item.notes}</Text> : null}
        {item.catches.length > 0 && <View style={{ gap: 8 }}>
          <Text style={[styles.section, { color: p.ink }]}>{t.catches}</Text>
          {item.catches.map((capture, index) => <Text key={`catch-${item.id}-${index}`} style={{ color: p.ink }}>
            {[capture.species, capture.size == null ? '' : `${capture.size} ${t.units.cm}`,
              capture.weight == null ? '' : `${capture.weight} ${t.units.kg}`, capture.bait, capture.time].filter(Boolean).join(' · ') || t.unavailable}
          </Text>)}
        </View>}
        {item.route && <View style={{ gap: 8 }}>
          <Text style={[styles.section, { color: p.ink }]}>{t.hike}</Text>
          {([['distance', 'km'], ['duration', 'min'], ['ascent', 'm']] as const).map(([field, unit]) =>
            item.route?.[field] != null && <Text key={field} style={{ color: p.ink }}>{t[field]} · {item.route[field]} {t.units[unit]}</Text>)}
        </View>}
        <MapView key={`map-${item.id}`} point={item.point} height={240} />
        <Conditions key={`conditions-${item.id}`} date={item.date} point={item.point} />
        <View style={{ gap: 12 }} onLayout={comments ? ({ nativeEvent }) => {
          scroll.current?.scrollTo({ y: nativeEvent.layout.y - side, animated: false });
        } : undefined}>
          <Text style={[styles.section, { color: p.ink }]}>{t.comments}</Text>
          {item.comments.length ? item.comments.map((entry, index) =>
            <Text key={`${entry.id}-${index}`} style={{ color: p.ink }}>{entry.text}</Text>)
            : <Text style={{ color: p.muted }}>{t.noComments}</Text>}
          <Field label={t.comment} placeholder={t.commentPlaceholder} value={text} onChangeText={setText} />
          {sendError && <Text style={{ color: p.danger }}>{t.saveError}</Text>}
          <Button label={t.send} icon="send-outline" disabled={sending || !text.trim()} onPress={() => void comment()} />
        </View>
      </ScrollView>}
  </>;
}
