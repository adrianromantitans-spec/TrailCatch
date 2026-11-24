import { Tabs, useRouter } from 'expo-router';
import { Alert } from 'react-native';
import { GlassTabBar, GlassTargets } from '../../components/GlassTabBar';
import { usePalette } from '../../components/ui';
import { t } from '../../i18n';
import { backend } from '../../services/backend';

export default function TabsLayout() {
  const router = useRouter();
  const p = usePalette();
  const openCreate = () => {
    if (!backend) { router.push('/create'); return; }
    Alert.alert(t.createMenu, undefined, [
      { text: t.cancel, style: 'cancel' },
      { text: t.create, onPress: () => router.push('/create') },
      { text: t.newPost, onPress: () => router.push('/post/create') },
    ]);
  };
  return (
    <GlassTargets>
      <Tabs screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: p.bg } }}
        tabBar={(props) => <GlassTabBar {...props} onCreate={openCreate} />}>
        <Tabs.Screen name="index" options={{ title: t.home }} />
        <Tabs.Screen name="map" options={{ title: t.map }} />
        <Tabs.Screen name="explore" options={{ title: t.search }} />
        <Tabs.Screen name="profile" options={{ title: t.profile }} />
      </Tabs>
    </GlassTargets>
  );
}
