import { useRouter } from 'expo-router';
import { TabContent, useTabClearance } from '../../components/GlassTabBar';
import { MapView } from '../../components/MapView';
import { Button, Header, Notice } from '../../components/ui';
import { useDiary } from '../../db/useDiary';
import { t } from '../../i18n';

export default function MapScreen() {
  const router = useRouter();
  const tabClearance = useTabClearance();
  const { items, error, load } = useDiary();
  return <TabContent name="map">
    <Header title={t.map}>
      <Button label={t.discoverMap} icon="compass-outline" onPress={() => router.push('/discover-map')} />
    </Header>
    {error ? <Notice message={t.loadError} retry={() => void load()} /> : !items
      ? <Notice message={t.loading} loading />
      : <MapView bottomOffset={tabClearance} outings={items}
          emptyMessage={items.length === 0 ? t.empty : undefined}
          onSelect={(id) => router.push({ pathname: '/outing/[id]', params: { id } })} />}
  </TabContent>;
}
