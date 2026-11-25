import { useEvent } from 'expo';
import { useIsFocused } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import type { VideoPlayer } from 'expo-video';
import { useEffect, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { t } from '../i18n';
import { IconButton, Notice, usePalette } from './ui';

function mutePlayer(player: VideoPlayer, muted: boolean) {
  player.muted = muted;
}

export function ReelVideo({ uri, autoplay = false }: { uri: string; autoplay?: boolean }) {
  const focused = useIsFocused();
  const p = usePalette();
  const [muted, setMuted] = useState(autoplay);
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = autoplay;
    instance.muted = autoplay;
  });
  const { status } = useEvent(player, 'statusChange', { status: player.status });

  useEffect(() => {
    if (autoplay && focused && AppState.currentState === 'active') player.play();
    else if (!focused) player.pause();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') player.pause();
    });
    return () => { subscription.remove(); };
  }, [autoplay, focused, player]);

  return <View style={styles.frame}>
      <VideoView player={player} nativeControls contentFit="contain" style={StyleSheet.absoluteFill} />
      {status === 'error' && <View style={[StyleSheet.absoluteFill, styles.notice]}>
        <Notice message={t.reelPlaybackError} retry={() => { void player.replaceAsync(uri).then(() => {
          if (autoplay && focused) player.play();
        }).catch(() => {}); }} />
      </View>}
      {autoplay && status !== 'error' && <View style={[styles.sound, { backgroundColor: p.glassSolid }]}>
        <IconButton label={muted ? t.reelUnmute : t.reelMute} name={muted ? 'volume-mute-outline' : 'volume-high-outline'}
          onPress={() => { mutePlayer(player, !muted); setMuted(!muted); }} />
      </View>}
  </View>;
}

const styles = StyleSheet.create({
  frame: { width: '100%', aspectRatio: 4 / 5, backgroundColor: '#16231E', borderRadius: 14, overflow: 'hidden' },
  notice: { backgroundColor: '#FFFFFF', justifyContent: 'center' },
  sound: { position: 'absolute', top: 8, right: 8, borderRadius: 22 },
});
