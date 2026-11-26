import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export function lightImpact() {
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }
}

export function selectionFeedback() {
  if (Platform.OS === 'ios' || Platform.OS === 'android') void Haptics.selectionAsync().catch(() => {});
}
