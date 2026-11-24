import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Sharing from 'expo-sharing';
import { ComponentRef, useRef, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';
import type { Photo } from '../db/model';
import { t } from '../i18n';
import { photoSource } from '../services/photos';
import { brandGreen, Button, onBrand, side, usePalette } from './ui';

export type OutingShareData = { title: string; category: string; metric?: string; photo?: Photo };

export function OutingShareCard({ data, onClose }: { data: OutingShareData; onClose: () => void }) {
  const p = usePalette();
  const card = useRef<ComponentRef<typeof View>>(null);
  const inProgress = useRef(false);
  const [photoReady, setPhotoReady] = useState(!data.photo);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function share() {
    if (inProgress.current || !card.current || !photoReady) return;
    inProgress.current = true;
    setBusy(true);
    setError(false);
    try {
      if (!(await Sharing.isAvailableAsync())) throw new Error(t.shareImageError);
      const uri = await captureRef(card.current, { format: 'jpg', quality: 0.92, width: 1080, height: 1350 });
      await Sharing.shareAsync(uri, { mimeType: 'image/jpeg', UTI: 'public.jpeg', dialogTitle: t.shareImage });
    } catch {
      setError(true);
    } finally {
      inProgress.current = false;
      setBusy(false);
    }
  }

  return (
    <Modal animationType="fade" transparent visible onRequestClose={() => { if (!inProgress.current) onClose(); }}>
      <SafeAreaView style={styles.overlay}>
        <View style={[styles.panel, { backgroundColor: p.bg }]}>
          <View ref={card} collapsable={false} style={styles.card}>
            {data.photo && !photoFailed
              ? <Image source={photoSource(data.photo)} style={styles.photo} contentFit="cover" cachePolicy="memory-disk"
                  onDisplay={() => setPhotoReady(true)} onError={() => { setPhotoFailed(true); setPhotoReady(true); }} />
              : <View style={styles.photo}><Ionicons name="image-outline" size={36} color={onBrand} /></View>}
            <View style={styles.details}>
              <Text style={styles.category}>{data.category}</Text>
              <Text style={styles.title} numberOfLines={2}>{data.title}</Text>
              {!!data.metric && <Text style={styles.metric}>{data.metric}</Text>}
              <Text style={styles.appName}>{t.app}</Text>
            </View>
          </View>
          {error && <Text accessibilityLiveRegion="polite" style={{ color: p.danger }}>{t.shareImageError}</Text>}
          <Button label={busy ? t.loading : t.shareImage} icon="share-outline" primary
            disabled={busy || !photoReady} onPress={() => void share()} />
          <Button label={t.cancel} disabled={busy} onPress={onClose} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: side, backgroundColor: '#101914B8' },
  panel: { width: '100%', maxWidth: 360, borderRadius: 20, padding: 16, gap: 12 },
  card: { width: '100%', aspectRatio: 4 / 5, borderRadius: 14, overflow: 'hidden', backgroundColor: brandGreen },
  photo: { flex: 1, backgroundColor: '#1C4938', alignItems: 'center', justifyContent: 'center' },
  details: { padding: 16, gap: 4 },
  category: { color: onBrand, fontSize: 12, fontWeight: '600' },
  title: { color: onBrand, fontSize: 22, fontWeight: '800' },
  metric: { color: onBrand, fontSize: 16, fontWeight: '700' },
  appName: { color: onBrand, fontSize: 12, marginTop: 8 },
});
