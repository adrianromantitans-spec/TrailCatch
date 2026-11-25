import { randomUUID } from 'expo-crypto';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { backend } from './backend';

export type ProfileDraft = { display_name: string; username: string; bio: string; avatar_url: string | null };
export type AvatarSource = 'camera' | 'gallery';
export const usernamePattern = /^[a-z0-9_]{3,24}$/;
const avatarBucket = 'avatars';

function client() {
  if (!backend) throw new Error('Backend unavailable');
  return backend;
}

export async function readProfileEditor(userId: string, signal: AbortSignal) {
  const db = client();
  const { data, error } = await db.from('profiles').select('display_name,username,bio,avatar_url')
    .eq('id', userId).abortSignal(signal).single();
  if (error?.code === '42703' || error?.code === 'PGRST204') {
    const legacy = await db.from('profiles').select('display_name,bio,avatar_url').eq('id', userId).abortSignal(signal).single();
    if (legacy.error) throw legacy.error;
    return { ready: false, draft: { ...legacy.data, username: '' } as ProfileDraft };
  }
  if (error) throw error;
  return { ready: true, draft: { ...data, username: data.username ?? '' } as ProfileDraft };
}

export async function profileUsernameAvailable(username: string, signal: AbortSignal) {
  const { data, error } = await client().rpc('profile_username_available', { candidate: username }).abortSignal(signal);
  if (error) throw error;
  return data === true;
}

export class AvatarPermissionError extends Error {
  constructor(readonly source: AvatarSource, readonly canAskAgain: boolean) { super('Avatar permission denied'); }
}

export async function pickAvatar(source: AvatarSource) {
  const camera = source === 'camera';
  const permission = await (camera ? ImagePicker.requestCameraPermissionsAsync() : ImagePicker.requestMediaLibraryPermissionsAsync());
  if (!permission.granted) throw new AvatarPermissionError(source, permission.canAskAgain);
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], shape: 'oval', exif: false, quality: 0.9 };
  const result = await (camera ? ImagePicker.launchCameraAsync(options) : ImagePicker.launchImageLibraryAsync(options));
  if (result.canceled) return;
  const asset = result.assets[0];
  const size = Math.min(asset.width, asset.height);
  if (!size) throw new Error('Invalid avatar');
  const image = ImageManipulator.manipulate(asset.uri);
  if (asset.width !== asset.height) image.crop({ originX: Math.floor((asset.width - size) / 2),
    originY: Math.floor((asset.height - size) / 2), width: size, height: size });
  if (size > 800) image.resize({ width: 800 });
  const rendered = await image.renderAsync();
  return (await rendered.saveAsync({ compress: 0.8, format: SaveFormat.JPEG })).uri;
}

export function discardAvatar(uri?: string) {
  if (!uri) return;
  try { const file = new File(uri); if (file.exists) file.delete(); } catch { /* The OS can clear the cache later. */ }
}

export async function uploadAvatar(userId: string, uri: string) {
  const bucket = client().storage.from(avatarBucket);
  const path = `${userId}/${randomUUID()}.jpg`;
  const { error } = await bucket.upload(path, await new File(uri).arrayBuffer(), { contentType: 'image/jpeg' });
  if (error) throw error;
  return bucket.getPublicUrl(path).data.publicUrl;
}

export async function removeOwnedAvatar(userId: string, url: string | null) {
  if (!url || !backend) return;
  const bucket = backend.storage.from(avatarBucket);
  const prefix = bucket.getPublicUrl(`${userId}/`).data.publicUrl;
  const filename = url.slice(prefix.length);
  if (url.startsWith(prefix) && /^[0-9a-f-]+\.jpg$/.test(filename)) await bucket.remove([`${userId}/${filename}`]);
}
