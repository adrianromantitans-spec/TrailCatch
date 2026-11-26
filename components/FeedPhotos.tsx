import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { usePalette } from './ui';

export type FeedSwipe = ReturnType<typeof Gesture.Pan>;

export function useFeedPhotoFrame() {
  const { height } = useWindowDimensions();
  return [layout.frame, { maxHeight: height * 0.45 }];
}

export function FeedPhotos<T>({ photos, photoKey, renderPhoto, feedSwipe, overlay }: {
  photos: readonly T[];
  photoKey: (photo: T, index: number) => string;
  renderPhoto: (photo: T) => ReactNode;
  feedSwipe?: FeedSwipe;
  overlay?: ReactNode;
}) {
  const p = usePalette();
  const frame = useFeedPhotoFrame();
  const [page, setPage] = useState({ width: 0, height: 0 });
  const [slide, setSlide] = useState(0);
  const multiple = photos.length > 1;
  const mediaSwipe = useMemo(() => feedSwipe ? Gesture.Native().blocksExternalGesture(feedSwipe) : undefined, [feedSwipe]);
  if (!photos.length) return null;

  const carousel = multiple && page.width > 0 && page.height > 0 ? <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}
    contentInsetAdjustmentBehavior="never"
    style={StyleSheet.absoluteFill} onMomentumScrollEnd={({ nativeEvent }) => {
      setSlide(Math.max(0, Math.min(photos.length - 1, Math.round(nativeEvent.contentOffset.x / page.width))));
    }}>
    {photos.map((photo, index) => <View key={photoKey(photo, index)} style={page}>{renderPhoto(photo)}</View>)}
  </ScrollView> : null;

  return <View>
    <View style={[frame, { backgroundColor: p.soft }]} onLayout={multiple ? ({ nativeEvent }) => {
      const { width, height } = nativeEvent.layout;
      setPage((previous) => previous.width === width && previous.height === height ? previous : { width, height });
    } : undefined}>
      {multiple ? (carousel && mediaSwipe ? <GestureDetector gesture={mediaSwipe}>{carousel}</GestureDetector> : carousel)
        : renderPhoto(photos[0])}
      {overlay}
    </View>
    {multiple && <View pointerEvents="none" style={layout.dots}>
      {photos.map((photo, index) => <View key={photoKey(photo, index)}
        style={[layout.dot, { backgroundColor: index === slide ? p.accent : p.line }]} />)}
    </View>}
  </View>;
}

const layout = StyleSheet.create({
  frame: { width: '100%', aspectRatio: 16 / 9, borderRadius: 16, overflow: 'hidden' },
  // The dots sit in the gap between the photo and the actions.
  dots: { position: 'absolute', left: 0, right: 0, bottom: -9, flexDirection: 'row', justifyContent: 'center', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
