import { useRouter } from 'expo-router';
import { ScrollView, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '../i18n';
import { Header, side, usePalette } from './ui';

export function Legal({ page }: { page: 'privacy' | 'terms' }) {
  const router = useRouter();
  const p = usePalette();
  const inset = useSafeAreaInsets();
  return <>
    <Header title={t[page]} back={() => router.back()} />
    <ScrollView contentContainerStyle={{ padding: side, paddingBottom: side + inset.bottom }}>
      <Text style={{ color: p.ink, fontSize: 16, lineHeight: 24 }}>{t[page === 'privacy' ? 'privacyBody' : 'termsBody']}</Text>
    </ScrollView>
  </>;
}
