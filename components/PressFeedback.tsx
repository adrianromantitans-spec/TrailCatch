import { forwardRef } from 'react';
import type { ComponentRef } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import type { PressableProps } from 'react-native';

export const PressFeedback = forwardRef<ComponentRef<typeof Pressable>, PressableProps & { cssInterop?: boolean }>(
  function PressFeedback({ style, hitSlop = 4, ...props }, ref) {
    return <Pressable {...props} ref={ref} cssInterop={false} hitSlop={hitSlop} style={(state) => {
      const current = typeof style === 'function' ? style(state) : style;
      if (!state.pressed) return current;
      const flattened = StyleSheet.flatten(current);
      const transform = flattened?.transform;
      const resting = typeof style === 'function' ? StyleSheet.flatten(style({ pressed: false })) : flattened;
      return [current, typeof transform === 'string'
        ? { opacity: (resting?.opacity ?? 1) * 0.9 }
        : { opacity: resting?.opacity, transform: [...(transform ?? []), { scale: 0.97 }] }];
    }} />;
  },
);
