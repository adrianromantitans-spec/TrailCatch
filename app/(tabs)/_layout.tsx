import { Tabs, useRouter } from 'expo-router';
import { GlassTabBar, GlassTargets } from '../../components/GlassTabBar';
import { usePalette } from '../../components/ui';
import { t } from '../../i18n';

export default function TabsLayout() {
  const router = useRouter();
  const p = usePalette();
  return (
    <GlassTargets>
      <Tabs screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: p.bg } }}
        tabBar={(props) => <GlassTabBar {...props} onCreate={() => router.push('/create')} />}>
        <Tabs.Screen name="index" options={{ title: t.home }} />
        <Tabs.Screen name="map" options={{ title: t.map }} />
        <Tabs.Screen name="explore" options={{ title: t.search }} />
        <Tabs.Screen name="profile" options={{ title: t.profile }} />
      </Tabs>
    </GlassTargets>
  );
}
