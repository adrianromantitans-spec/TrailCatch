import Constants from 'expo-constants';
import Storage from 'expo-sqlite/kv-store';
import { Platform } from 'react-native';
import { requireBackend } from './social';

const cacheKey = 'trailcatch-push-token';
export async function enablePush(): Promise<'enabled' | 'denied' | 'unavailable'> {
  if (Constants.executionEnvironment === 'storeClient' || (Platform.OS !== 'ios' && Platform.OS !== 'android')) return 'unavailable';
  const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) return 'unavailable';
  const notifications = await import('expo-notifications');
  if (Platform.OS === 'android') await notifications.setNotificationChannelAsync('default', {
    name: 'TrailCatch', importance: notifications.AndroidImportance.DEFAULT,
  });
  let permission = await notifications.getPermissionsAsync();
  if (!permission.granted && permission.canAskAgain) permission = await notifications.requestPermissionsAsync();
  if (!permission.granted) return 'denied';
  const { data: token } = await notifications.getExpoPushTokenAsync({ projectId });
  const { error } = await requireBackend().rpc('register_push_token', { expo_token: token, device_platform: Platform.OS });
  if (error) throw error;
  await Storage.setItem(cacheKey, token);
  return 'enabled';
}

export async function unregisterPush() {
  const token = await Storage.getItem(cacheKey);
  if (!token) return;
  const { error } = await requireBackend().from('push_tokens').delete().eq('token', token);
  if (error) throw error;
  await Storage.removeItem(cacheKey);
}
