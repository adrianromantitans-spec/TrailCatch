import { isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Redirect, Tabs, useRouter } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { ActivityIndicator, Alert, Platform, View } from 'react-native';
import { GlassTabBar, GlassTargets, useNativeHomeCompact } from '../../components/GlassTabBar';
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
  const useNativeBar = Platform.OS === 'ios' && isGlassEffectAPIAvailable() && isLiquidGlassAvailable();

  if (useNativeBar) return (
    <GlassTargets nativeBar onCreate={openCreate}>
      <NativeTabLayout onCreate={openCreate} />
    </GlassTargets>
  );

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

function NativeTabLayout({ onCreate }: { onCreate: () => void }) {
  const p = usePalette();
  const compact = useNativeHomeCompact();

  return (
    <NativeTabs tintColor={p.accent} iconColor={{ default: p.muted, selected: p.accent }}
      hidden={compact} disableHiddenAnimation minimizeBehavior="never">
      <NativeTabs.Trigger name="index" disableAutomaticContentInsets>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} />
        <NativeTabs.Trigger.Label>{t.home}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="map" disableAutomaticContentInsets>
        <NativeTabs.Trigger.Icon sf={{ default: 'map', selected: 'map.fill' }} />
        <NativeTabs.Trigger.Label>{t.map}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="create-action" disabled disableAutomaticContentInsets listeners={{
        tabPress: ({ data }) => { if (data.isPrevented) onCreate(); },
      }}>
        <NativeTabs.Trigger.Icon sf="plus.circle.fill" />
        <NativeTabs.Trigger.Label>{t.createMenu}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="explore" disableAutomaticContentInsets>
        <NativeTabs.Trigger.Icon sf="magnifyingglass" />
        <NativeTabs.Trigger.Label>{t.search}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile" disableAutomaticContentInsets>
        <NativeTabs.Trigger.Icon sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }} />
        <NativeTabs.Trigger.Label>{t.profile}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
