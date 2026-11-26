import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { onBrand, usePalette } from './ui';

const ToastContext = createContext<(message: string) => void>(() => {});
export const useToast = () => useContext(ToastContext);
const enter = FadeIn.duration(150).reduceMotion(ReduceMotion.System);
const exit = FadeOut.duration(150).reduceMotion(ReduceMotion.System);

export function ToastProvider({ children }: PropsWithChildren) {
  const p = usePalette();
  const { top } = useSafeAreaInsets();
  const [message, setMessage] = useState<string>();
  const timeout = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timeout.current), []);
  const showToast = useCallback((next: string) => {
    clearTimeout(timeout.current);
    setMessage(next);
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(next);
    timeout.current = setTimeout(() => setMessage(undefined), 2200);
  }, []);
  return <ToastContext.Provider value={showToast}>
    {children}
    <View pointerEvents="none" style={[layout.host, { top: top + 12 }]}>
      {!!message && <Animated.View entering={enter} exiting={exit} style={[layout.toast, { backgroundColor: p.accent }]}>
        <Text accessibilityLiveRegion="polite" style={layout.label}>{message}</Text>
      </Animated.View>}
    </View>
  </ToastContext.Provider>;
}

const layout = StyleSheet.create({
  host: { position: 'absolute', left: 16, right: 16, alignItems: 'center', zIndex: 20 },
  toast: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 14 },
  label: { color: onBrand, fontWeight: '700', textAlign: 'center' },
});
