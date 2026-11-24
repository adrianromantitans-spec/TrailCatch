import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Linking, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CategoryBadge } from '../../components/CategoryPicker';
import { MapView } from '../../components/MapView';
import { Button, Header, Notice, side, styles, usePalette } from '../../components/ui';
import { t } from '../../i18n';
import { backend, useSession } from '../../services/backend';
import type { Spot } from '../../services/spots';

type SpotImage = { id: string; uri: string };

export default function SpotDetails() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const p = usePalette();
  const inset = useSafeAreaInsets();
  const [spot, setSpot] = useState<Spot | null>();
  const [images, setImages] = useState<SpotImage[]>([]);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(() => new AbortController());

  useFocusEffect(useCallback(() => {
    const client = backend;
    if (!client) return;
    let active = true;
    setFailed(false);
    void (async () => {
      try {
        const detail = await client.from('spot_details').select().eq('id', id).abortSignal(retry.signal).maybeSingle();
        if (detail.error) throw detail.error;
        if (!active) return;
        setSpot(detail.data as Spot | null);
        if (!detail.data) return;
        const gallery = await client.from('spot_photos').select('id,url,thumbnail_url').eq('spot_id', id).order('position');
        if (gallery.error) throw gallery.error;
        const paths = gallery.data.map(({ url }) => url);
        const signed = paths.length ? await client.storage.from('spot-photos').createSignedUrls(paths, 120) : null;
        if (signed?.error) throw signed.error;
        if (active) setImages(gallery.data.flatMap((item, index) => {
          const uri = signed?.data?.[index]?.signedUrl;
          return uri ? [{ id: item.id, uri }] : [];
        }));
      } catch { if (active) setFailed(true); }
    })();
    return () => { active = false; };
  }, [id, retry]));

  function report(kind: 'spot' | 'user' | 'photo', target: string) {
    router.push({ pathname: '/report', params: { kind, id: target } });
  }

  function block(user: string) {
    if (!session || !backend) { router.push('/account'); return; }
    const client = backend;
    Alert.alert(t.blockPrompt, undefined, [
      { text: t.cancel, style: 'cancel' },
      { text: t.block, style: 'destructive', onPress: async () => {
        const { error } = await client.from('blocks').insert({ blocker_id: session.user.id, blocked_id: user });
        if (error) Alert.alert(t.actionError); else router.back();
      } },
    ]);
  }

  return <>
    <Header title={spot?.name ?? t.spots} back={() => router.back()} />
    {!backend ? <Notice message={t.backendUnavailable} /> : failed
      ? <Notice message={t.loadError} retry={() => { retry.abort(); setRetry(new AbortController()); }} /> : !spot
      ? <Notice message={spot === null ? t.spotMissing : t.loading} loading={spot === undefined} />
      : <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingBottom: inset.bottom + side }]}>
          <CategoryBadge type={spot.type} />
          {images.length > 0 && <ScrollView horizontal contentContainerStyle={styles.columns}>
            {images.map(({ id: photoId, uri }) => <View key={photoId} style={styles.group}>
              <Image source={uri} cachePolicy="memory" style={{ width: 240, aspectRatio: 4 / 5, borderRadius: 14 }} />
              {spot.user_id !== session?.user.id && <Button label={t.report} onPress={() => report('photo', photoId)} />}
            </View>)}
          </ScrollView>}
          {[spot.description, spot.species.join(', '), spot.difficulty ? t[spot.difficulty] : '', spot.season, spot.directions,
            spot.requires_permit ? t.permit : '', spot.approximate_location ? t.approximate : '',
            spot.origin === 'OpenStreetMap' ? t.osm : ''].filter(Boolean).map((line, index) =>
            <Text key={index} style={{ color: p.ink }}>{line}</Text>)}
          <MapView key={spot.id} height={240} point={{ latitude: spot.latitude, longitude: spot.longitude }} />
          <Text style={{ color: p.muted }}>{t.spotWarning}</Text>
          <Button label={t.directions} icon="navigate-outline" onPress={() => {
            const destination = encodeURIComponent(`${spot.latitude},${spot.longitude}`);
            void Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${destination}`)
              .catch(() => Alert.alert(t.actionError));
          }} />
          {spot.user_id !== session?.user.id && <View style={styles.row}>
            <Button label={t.reportSpot} onPress={() => report('spot', spot.id)} />
            <Button label={t.reportUser} onPress={() => report('user', spot.user_id)} />
            <Button label={t.block} danger onPress={() => block(spot.user_id)} />
          </View>}
        </ScrollView>}
  </>;
}
