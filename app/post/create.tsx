import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Field, Header, Notice, side, styles, usePalette } from '../../components/ui';
import type { Photo } from '../../db/model';
import { useDiary } from '../../db/useDiary';
import { t } from '../../i18n';
import { backend, useSession } from '../../services/backend';
import { discardPhotos, photoSource, selectPhotos } from '../../services/photos';
import { publishPost } from '../../services/social';

export default function CreatePost() {
  const router = useRouter();
  const p = usePalette();
  const inset = useSafeAreaInsets();
  const { session } = useSession();
  const { items } = useDiary();
  const [caption, setCaption] = useState('');
  const [audience, setAudience] = useState<'public' | 'friends'>('public');
  const [approximate, setApproximate] = useState(true);
  const [shareLocation, setShareLocation] = useState(false);
  const [trip, setTrip] = useState<string>();
  const [spot, setSpot] = useState<string>();
  const [chooser, setChooser] = useState<'spot' | 'trip'>();
  const [search, setSearch] = useState('');
  const [spots, setSpots] = useState<{ id: string; name: string; visibility: string }[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const files = useRef<Photo[]>([]);
  const active = useRef(true);
  const lock = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; discardPhotos(files.current); files.current = []; };
  }, []);
  useEffect(() => {
    if (!backend || chooser !== 'spot') return;
    let alive = true;
    const timer = setTimeout(() => {
      void backend!.from('spots').select('id,name,visibility')
        .in('visibility', audience === 'public' ? ['public'] : ['public','friends'])
        .ilike('name', `%${search.replace(/[%_]/g,'')}%`).order('name').limit(20)
        .then(({ data, error }) => {
          if (alive) { setSpots(data ?? []); if (error) setMessage(t.loadError); }
        });
    }, 220);
    return () => { alive = false; clearTimeout(timer); };
  }, [audience, chooser, search]);

  async function pick() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setMessage('');
    try {
      const selected = await selectPhotos(true, false);
      if (!active.current) { discardPhotos(selected.photos); return; }
      const incoming = selected.photos.slice(0, 10 - files.current.length);
      discardPhotos(selected.photos.slice(incoming.length));
      files.current = [...files.current, ...incoming];
      setPhotos(files.current);
    } catch { if (active.current) setMessage(t.photosError); }
    finally { lock.current = false; if (active.current) setBusy(false); }
  }

  async function save() {
    if (lock.current || !session || (!caption.trim() && !photos.length)) return;
    lock.current = true; setBusy(true); setMessage('');
    const owned = files.current; files.current = [];
    try {
      const tripData = items?.find((item) => item.id === trip);
      const id = await publishPost({
        viewer: session.user.id, caption: caption.trim(), audience, approximate, spotId: spot, tripId: trip,
        point: shareLocation ? tripData?.point : undefined, photos: owned,
        tripPreview: tripData ? { title: tripData.title.slice(0, 120), type: tripData.type, distance: tripData.route?.distance } : undefined,
      });
      discardPhotos(owned);
      if (active.current) router.replace({ pathname: '/post/[id]', params: { id } });
    } catch {
      if (active.current) { files.current = owned; setMessage(t.postError); } else discardPhotos(owned);
    } finally { lock.current = false; if (active.current) setBusy(false); }
  }

  return <>
    <Header title={t.newPost} back={() => router.back()} />
    {!backend ? <Notice message={t.backendUnavailable} /> : !session ? <View style={styles.content}>
      <Notice message={t.signInRequired} /><Button label={t.signIn} onPress={() => router.push('/account')} />
    </View> : <ScrollView style={styles.screen} keyboardShouldPersistTaps="handled"
      contentContainerStyle={[styles.content, { paddingBottom: inset.bottom + side }]}>
      <ScrollView horizontal contentContainerStyle={styles.columns}>
        {photos.map((photo, index) => <View key={index} style={styles.group}>
          <Image source={photoSource(photo)} style={{ width: 96, aspectRatio: 4 / 5, borderRadius: 12 }} />
          <Button label={t.removePhoto} disabled={busy} onPress={() => {
            discardPhotos([photo]); files.current = files.current.filter((item) => item !== photo); setPhotos(files.current);
          }} />
        </View>)}
      </ScrollView>
      <Button label={t.addMorePhotos} icon="images-outline" disabled={busy || photos.length >= 10} onPress={() => void pick()} />
      <Field label={t.caption} value={caption} onChangeText={setCaption} multiline maxLength={2200} />
      <Text style={[styles.fieldLabel, { color: p.ink }]}>{t.visibility}</Text>
      <View style={styles.columns}>
        <Button stretch label={t.public} selected={audience === 'public'} disabled={busy} onPress={() => { setAudience('public'); setSpot(undefined); }} />
        <Button stretch label={t.friends} selected={audience === 'friends'} disabled={busy} onPress={() => setAudience('friends')} />
      </View>
      <View style={styles.columns}>
        <Button stretch label={t.linkSpot} selected={!!spot || chooser === 'spot'} disabled={busy} onPress={() => setChooser(chooser === 'spot' ? undefined : 'spot')} />
        <Button stretch label={t.linkOuting} selected={!!trip || chooser === 'trip'} disabled={busy} onPress={() => setChooser(chooser === 'trip' ? undefined : 'trip')} />
      </View>
      {chooser === 'spot' && <View style={styles.group}>
        <Field label={t.spotSearch} value={search} onChangeText={setSearch} />
        <Button label={t.noLink} disabled={busy} onPress={() => { setSpot(undefined); setChooser(undefined); }} />
        {spots.map((item) => <Button key={item.id} label={item.name} selected={spot === item.id} disabled={busy}
          onPress={() => { setSpot(item.id); setChooser(undefined); }} />)}
      </View>}
      {chooser === 'trip' && <View style={styles.group}>
        <Button label={t.noLink} disabled={busy} onPress={() => { setTrip(undefined); setChooser(undefined); }} />
        {(items ?? []).filter((item) => !item.sample).slice(0, 20).map((item) =>
          <Button key={item.id} label={item.title} selected={trip === item.id} disabled={busy}
            onPress={() => { setTrip(item.id); setChooser(undefined); }} />)}
      </View>}
      {trip && <View style={styles.metricRow}>
        <Text style={[styles.metricLabel, { color: p.ink }]}>{t.shareLocation}</Text>
        <Switch accessibilityLabel={t.shareLocation} disabled={busy} value={shareLocation} onValueChange={setShareLocation} />
      </View>}
      <View style={styles.metricRow}>
        <Text style={[styles.metricLabel, { color: p.ink }]}>{t.approximate}</Text>
        <Switch accessibilityLabel={t.approximate} disabled={busy} value={approximate} onValueChange={setApproximate} />
      </View>
      {!!message && <Text style={{ color: p.danger }}>{message}</Text>}
      <Button label={busy ? t.loading : t.publishPost} primary disabled={busy || (!caption.trim() && !photos.length)} onPress={() => void save()} />
    </ScrollView>}
  </>;
}
