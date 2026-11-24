import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabContent } from '../../components/GlassTabBar';
import { MapView } from '../../components/MapView';
import { Header, Notice, usePalette } from '../../components/ui';
import { useDiary } from '../../db/useDiary';
import { t } from '../../i18n';

export default function MapScreen() {
  const router = useRouter();
  const p = usePalette();
  const inset = useSafeAreaInsets();
  const { items, error, load } = useDiary();
  return <TabContent name="map">
    <Header title={t.map} />
    {error ? <Notice message={t.loadError} retry={() => void load()} /> : !items
      ? <Notice message={t.loading} loading />
      : <View style={{ flex: 1 }}><MapView footerInset={inset.bottom} outings={items} onSelect={(id) => router.push({ pathname: '/outing/[id]', params: { id } })} />
        {items.length === 0 && <View pointerEvents="none" style={{ position: 'absolute', bottom: 125 + inset.bottom,
          left: 12, backgroundColor: p.glassSolid, padding: 8, borderRadius: 8 }}>
          <Text style={{ color: p.ink }}>{t.empty}</Text>
        </View>}
      </View>}
  </TabContent>;
}
