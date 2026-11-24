import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import type { Photo } from '../db/model';

const directory = new Directory(Paths.document, 'trailcatch-photos');
export const sampleImages = { lake: require('../assets/lake.jpg'), trail: require('../assets/trail.jpg') };
export const photoSource = (photo: Photo) => 'sample' in photo ? sampleImages[photo.sample] : { uri: photoFile(photo).uri };

export function photoFile(photo: Extract<Photo, { uri: string }>) {
  return new File(directory, photo.uri);
}

export type PhotoOrigin = 'library' | 'camera';
export class CameraPermissionError extends Error {}

export async function selectPhotos(origin: PhotoOrigin, multiple: boolean): Promise<Extract<Photo, { uri: string }>[]> {
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], exif: false };
  if (origin === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new CameraPermissionError();
  }
  const result = origin === 'camera'
    ? await ImagePicker.launchCameraAsync({ ...options, cameraType: ImagePicker.CameraType.back })
    : await ImagePicker.launchImageLibraryAsync({
        ...options, allowsMultipleSelection: multiple, selectionLimit: multiple ? 0 : 1,
      });
  if (result.canceled) return [];
  directory.create({ idempotent: true, intermediates: true });
  const output: Extract<Photo, { uri: string }>[] = [];
  try {
    for (const asset of result.assets) {
      const context = ImageManipulator.manipulate(asset.uri);
      if (asset.width > 1080) context.resize({ width: 1080 });
      const rendered = await context.renderAsync();
      const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.83 });
      const temp = new File(saved.uri);
      try {
        const name = temp.name;
        // The cache file must remain available until the native copy finishes.
        await temp.copy(new File(directory, name));
        output.push({ uri: name });
      } finally {
        try { temp.delete(); } catch { /* The system can clear the cache later. */ }
      }
    }
    return output;
  } catch (error) {
    discardPhotos(output);
    throw error;
  }
}

export function removePhoto(photo: Photo) {
  if ('sample' in photo) return;
  const file = photoFile(photo);
  if (file.exists) file.delete();
}

export function discardPhotos(photos: Iterable<Photo>) {
  for (const photo of photos) {
    try { removePhoto(photo); } catch { /* Continue cleaning up the other draft photos. */ }
  }
}

export function removeAllPhotos() {
  if (directory.exists) directory.delete();
}

export async function exportPhotos(photos: Photo[]) {
  const files: Record<string, string> = {};
  for (const photo of photos) {
    if ('uri' in photo && !(photo.uri in files)) {
      files[photo.uri] = await photoFile(photo).base64();
    }
  }
  return files;
}
