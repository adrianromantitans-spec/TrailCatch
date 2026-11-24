import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import type { Photo, Point } from '../db/model';

const directory = new Directory(Paths.document, 'trailcatch-photos');
export const sampleImages = { lake: require('../assets/lake.jpg'), trail: require('../assets/trail.jpg') };
export const photoSource = (photo: Photo) => 'sample' in photo ? sampleImages[photo.sample] : { uri: photoFile(photo).uri };

export function photoFile(photo: Extract<Photo, { uri: string }>) {
  return new File(directory, photo.uri);
}

type PhotoAsset = { uri: string; width: number; exif?: Record<string, unknown> | null };
export type PhotoBatch = { photos: Photo[]; point?: Point };

function coordinate(value: unknown, reference: unknown, negativeReference: string) {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return NaN;
  const degrees = Number(value);
  return reference === negativeReference ? -Math.abs(degrees) : degrees;
}

function photoPoint(asset: PhotoAsset): Point | undefined {
  const exif = asset.exif;
  if (!exif) return;
  const latitude = coordinate(exif.GPSLatitude, exif.GPSLatitudeRef, 'S');
  const longitude = coordinate(exif.GPSLongitude, exif.GPSLongitudeRef, 'W');
  if (Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) return { latitude, longitude };
}

export async function selectPhotos(multiple: boolean, readLocation: boolean): Promise<PhotoBatch> {
  // The system picker grants access only to the selected images.
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'], exif: readLocation, allowsMultipleSelection: multiple, selectionLimit: multiple ? 0 : 1,
  });
  return result.canceled ? { photos: [] } : savePhotos(result.assets, readLocation);
}

export async function saveCapturedPhoto(asset: PhotoAsset, readLocation: boolean): Promise<PhotoBatch> {
  try {
    return await savePhotos([asset], readLocation);
  } finally {
    clearTemporaryFile(new File(asset.uri));
  }
}

function clearTemporaryFile(file: File) {
  try { if (file.exists) file.delete(); } catch { /* The system can clear the cache later. */ }
}

async function savePhotos(assets: PhotoAsset[], readLocation: boolean): Promise<PhotoBatch> {
  directory.create({ idempotent: true, intermediates: true });
  const photos: Photo[] = [];
  let point: Point | undefined;
  try {
    for (const asset of assets) {
      if (readLocation) point ??= photoPoint(asset);
      const context = ImageManipulator.manipulate(asset.uri);
      if (asset.width > 1080) context.resize({ width: 1080 });
      const rendered = await context.renderAsync();
      const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.83 });
      const temp = new File(saved.uri);
      try {
        const name = temp.name;
        // The cache file must remain available until the native copy finishes.
        await temp.copy(new File(directory, name));
        photos.push({ uri: name });
      } finally {
        clearTemporaryFile(temp);
      }
    }
    return { photos, point };
  } catch (error) {
    discardPhotos(photos);
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
