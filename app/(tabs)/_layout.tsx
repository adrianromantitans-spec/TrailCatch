import { Redirect, Tabs, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, View } from 'react-native';
import { GlassTabBar, GlassTargets } from '../../components/GlassTabBar';
import { usePalette } from '../../components/ui';
import { t } from '../../i18n';
import { backend, useSession } from '../../services/backend';

export default function TabsLayout() {
  const router = useRouter();
  const p = usePalette();
  const { session, guest, loading, profileSetup } = useSession();
  if (loading || profileSetup === 'checking') return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.bg }}>
    <ActivityIndicator accessibilityLabel={t.loading} color={p.accent} />
  </View>;
  if (backend && !session && !guest) return <Redirect href="/welcome" />;
  if (profileSetup === 'required') return <Redirect href="/account" />;
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
        <Tabs.Screen name="create-action" options={{ href: null }} />
        <Tabs.Screen name="explore" options={{ title: t.search }} />
        <Tabs.Screen name="profile" options={{ title: t.profile }} />
      </Tabs>
    </GlassTargets>
  );
}
