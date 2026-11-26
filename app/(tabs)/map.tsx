import { useRouter } from 'expo-router';
import { FeedHeader } from '../../components/FeedHeader';
import { TabContent, useTabClearance } from '../../components/GlassTabBar';
import { MapLoading, MapView } from '../../components/MapView';
import { Button, Notice } from '../../components/ui';
import { useDiary } from '../../db/useDiary';
import { t } from '../../i18n';

export default function MapScreen() {
  const router = useRouter();
  const tabClearance = useTabClearance();
  const { items, error, load } = useDiary();
  return <TabContent name="map">
    <FeedHeader safeTop align="left" title={t.map} action={
      <Button label={t.discoverMap} icon="compass-outline" singleLine onPress={() => router.push('/discover-map')} />} />
    {error ? <Notice message={t.loadError} retry={() => void load()} /> : !items
      ? <MapLoading />
      : <MapView bottomOffset={tabClearance} outings={items} compactLayers
          emptyMessage={items.length === 0 ? t.empty : undefined}
          onSelect={(id) => router.push({ pathname: '/outing/[id]', params: { id } })} />}
  </TabContent>;
}
