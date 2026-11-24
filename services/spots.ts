import { randomUUID } from 'expo-crypto';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { File } from 'expo-file-system';
import type { OutingType, Photo, Point } from '../db/model';
import { backend } from './backend';
import { photoFile } from './photos';

export type Visibility = 'private' | 'friends' | 'public';
export type Difficulty = 'easy' | 'moderate' | 'hard';
export type Spot = {
  id: string; user_id: string; name: string; type: OutingType; description: string; latitude: number; longitude: number;
  species: string[]; difficulty: Difficulty | null; season: string; directions: string; requires_permit: boolean;
  approximate_location: boolean; visibility: Visibility; origin: string | null;
};
type Draft = Omit<Spot, 'id' | 'user_id' | 'origin' | 'latitude' | 'longitude'> & { point: Point; photos: Photo[] };

export async function saveSpot(userId: string, draft: Draft) {
  if (!backend) throw new Error('Missing backend configuration');
  const client = backend;
  const { data: id, error } = await client.rpc('create_spot', {
    spot_type: draft.type, spot_name: draft.name, spot_description: draft.description,
    latitude: draft.point.latitude, longitude: draft.point.longitude, spot_species: draft.species,
    spot_difficulty: draft.difficulty, spot_season: draft.season, spot_directions: draft.directions,
    permit: draft.requires_permit, spot_visibility: draft.visibility, approximate: draft.approximate_location,
  });
  if (error) throw error;
  const uploaded: string[] = [];
  const bucket = client.storage.from('spot-photos');
  try {
    for (const [position, photo] of draft.photos.slice(0, 5).entries()) {
      if ('sample' in photo) continue;
      const name = `${userId}/${randomUUID()}`;
      const url = `${name}.jpg`;
      const thumbnail = `${name}-thumb.jpg`;
      const file = photoFile(photo);
      const context = ImageManipulator.manipulate(file.uri).resize({ width: 320 });
      const rendered = await context.renderAsync();
      const thumb = new File((await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.78 })).uri);
      try {
        for (const [path, image] of [[url, file], [thumbnail, thumb]] as const) {
          const result = await bucket.upload(path, await image.arrayBuffer(), { contentType: 'image/jpeg' });
          if (result.error) throw result.error;
          uploaded.push(path);
        }
        const result = await client.from('spot_photos').insert({ spot_id: id, position, url, thumbnail_url: thumbnail });
        if (result.error) throw result.error;
      } finally {
        try { if (thumb.exists) thumb.delete(); } catch { /* Temporary files are managed by the OS. */ }
      }
    }
    return id as string;
  } catch (failure) {
    await client.from('spots').delete().eq('id', id);
    if (uploaded.length) await bucket.remove(uploaded);
    throw failure;
  }
}
