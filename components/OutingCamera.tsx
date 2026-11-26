import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { AppState, Linking, StyleSheet, Text, View } from 'react-native';
import { PressFeedback as Pressable } from './PressFeedback';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Photo } from '../db/model';
import { t } from '../i18n';
import { discardPhotos, photoSource, saveCapturedPhoto, selectPhotos } from '../services/photos';
import type { PhotoBatch } from '../services/photos';

export function OutingCamera({ onClose, onPhotos, multiple, readLocation, preview }: {
  onClose: () => void; onPhotos: (batch: PhotoBatch) => void;
  multiple: boolean; readLocation: boolean; preview?: Photo;
}) {
  const inset = useSafeAreaInsets();
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const mounted = useRef(true);
  const prompted = useRef(false);
  const running = useRef(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (permission?.status !== 'undetermined' || prompted.current) return;
    prompted.current = true;
    void requestPermission().catch(() => { if (mounted.current) setMessage(t.cameraError); });
  }, [permission?.status, requestPermission]);

  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active' && permission?.status === 'denied') {
        void getPermission().catch(() => { if (mounted.current) setMessage(t.cameraError); });
      }
    });
    return () => listener.remove();
  }, [getPermission, permission?.status]);

  async function choose(useCamera: boolean) {
    const device = camera.current;
    if (running.current || (useCamera && (!ready || !device))) return;
    running.current = true;
    setBusy(true);
    setMessage(undefined);
    try {
      const batch = useCamera && device
        ? await saveCapturedPhoto(await device.takePictureAsync({ exif: readLocation }), readLocation)
        : await selectPhotos(multiple, readLocation);
      if (!mounted.current) discardPhotos(batch.photos);
      else if (batch.photos.length) onPhotos(batch);
    } catch {
      if (mounted.current) setMessage(useCamera ? t.cameraError : t.photosError);
    } finally {
      running.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  function requestAccess() {
    const action = permission?.canAskAgain ? requestPermission : Linking.openSettings;
    void action().catch(() => { if (mounted.current) setMessage(t.cameraError); });
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      {permission?.granted && <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" mode="picture"
        onCameraReady={() => setReady(true)}
        onMountError={() => { setReady(false); setMessage(t.cameraError); }} />}
      <Pressable accessibilityRole="button" accessibilityLabel={t.cancel} onPress={() => { mounted.current = false; onClose(); }}
        style={[styles.close, { top: inset.top + 12, left: inset.left + 20 }]}>
        <Ionicons name="close" size={26} color="#FFF" />
      </Pressable>
      {permission && !permission.granted && permission.status !== 'undetermined' && <View style={styles.permission}>
        <Text style={styles.permissionText}>{t.cameraDenied}</Text>
        <Pressable accessibilityRole="button" style={styles.permissionButton} onPress={requestAccess}>
          <Text style={styles.permissionText}>{permission.canAskAgain ? t.allowCamera : t.settings}</Text>
        </Pressable>
      </View>}
      <View style={[styles.controls, {
        bottom: Math.max(inset.bottom, 12) + 16, left: inset.left + 20, right: inset.right + 20,
      }]}>
        {(busy || message) && <Text accessibilityLiveRegion="polite" style={styles.message}>
          {busy ? t.addingPhotos : message}
        </Text>}
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" accessibilityLabel={t.gallery} disabled={busy}
            style={styles.gallery} onPress={() => void choose(false)}>
            {preview
              ? <Image source={photoSource(preview)} style={styles.preview} contentFit="cover" />
              : <Ionicons name="images-outline" size={25} color="#FFF" />}
            <Text style={styles.galleryLabel}>{t.gallery}</Text>
          </Pressable>
          <Pressable cssInterop={false} accessibilityRole="button" accessibilityLabel={t.takePhoto} disabled={!permission?.granted || !ready || busy}
            onPress={() => void choose(true)}
            style={({ pressed }) => [styles.shutter, { opacity: !ready || busy ? 0.45 : pressed ? 0.7 : 1 }]}>
            <View style={styles.shutterCenter} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#101714', justifyContent: 'center' },
  close: { position: 'absolute', width: 48, height: 48, borderRadius: 24, alignItems: 'center',
    justifyContent: 'center', backgroundColor: '#15251ED9' },
  controls: { position: 'absolute', gap: 12 },
  actions: { height: 84, alignItems: 'center', justifyContent: 'center' },
  gallery: { position: 'absolute', left: 0, width: 72, minHeight: 64, borderRadius: 14, gap: 3,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#15251ED9', paddingVertical: 8 },
  galleryLabel: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  preview: { width: 28, height: 28, borderRadius: 5 },
  shutter: { width: 76, height: 76, borderRadius: 38, borderWidth: 3, borderColor: '#FFF',
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#15251E80' },
  shutterCenter: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#FFF' },
  permission: { paddingHorizontal: 32, alignItems: 'center', gap: 16 },
  permissionText: { color: '#FFF', textAlign: 'center', fontWeight: '600' },
  permissionButton: { backgroundColor: '#255A46', paddingHorizontal: 16, minHeight: 44, borderRadius: 14, justifyContent: 'center' },
  message: { alignSelf: 'center', color: '#FFF', textAlign: 'center', backgroundColor: '#15251ED9',
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
});
