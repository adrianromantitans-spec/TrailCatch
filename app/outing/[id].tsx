import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ComponentRef, useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
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
      const newComment = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, text: text.trim() };
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
      : <ScrollView ref={scroll} keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: side, gap: 17, paddingBottom: inset.bottom + side }}>
        <Text style={{ color: p.muted }}>{t[item.type]} · {relativeDate(item.date)}</Text>
        {photos.length > 0 && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 9 }}>
          {photos.map((photo, index) => <Image key={index} source={photoSource(photo)} transition={150}
            style={{ width: 220, height: 260, borderRadius: 13, backgroundColor: p.soft }} />)}
        </ScrollView>}
        {item.notes ? <Text style={{ color: p.ink, fontSize: 16 }}>{item.notes}</Text> : null}
        {item.catches.length > 0 && <View style={{ gap: 8 }}>
          <Text style={[styles.section, { color: p.ink }]}>{t.catches}</Text>
          {item.catches.map((capture, index) => <Text key={index} style={{ color: p.ink }}>
            {[capture.species, capture.size == null ? '' : `${capture.size} ${t.units.cm}`,
              capture.weight == null ? '' : `${capture.weight} ${t.units.kg}`, capture.bait, capture.time].filter(Boolean).join(' · ') || t.unavailable}
          </Text>)}
        </View>}
        {item.route && <View style={{ gap: 5 }}>
          <Text style={[styles.section, { color: p.ink }]}>{t.hike}</Text>
          {([['distance', 'km'], ['duration', 'min'], ['ascent', 'm']] as const).map(([field, unit]) =>
            item.route?.[field] != null && <Text key={field} style={{ color: p.ink }}>{t[field]} · {item.route[field]} {t.units[unit]}</Text>)}
        </View>}
        <MapView key={item.id} point={item.point} height={240} />
        <Conditions key={item.id} date={item.date} point={item.point} />
        <View style={{ gap: 9 }} onLayout={comments ? ({ nativeEvent }) => {
          scroll.current?.scrollTo({ y: nativeEvent.layout.y - side, animated: false });
        } : undefined}>
          <Text style={[styles.section, { color: p.ink }]}>{t.comments}</Text>
          {item.comments.length ? item.comments.map((entry) =>
            <Text key={entry.id} style={{ color: p.ink }}>{entry.text}</Text>)
            : <Text style={{ color: p.muted }}>{t.noComments}</Text>}
          <Field label={t.comment} placeholder={t.commentPlaceholder} value={text} onChangeText={setText} />
          {sendError && <Text style={{ color: p.danger }}>{t.saveError}</Text>}
          <Button label={t.send} icon="send-outline" disabled={sending || !text.trim()} onPress={() => void comment()} />
        </View>
      </ScrollView>}
  </>;
}
