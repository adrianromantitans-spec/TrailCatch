import { randomUUID } from 'expo-crypto';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { OutingType, Photo, Point } from '../db/model';
import { backend } from './backend';
import { photoFile } from './photos';

export type Profile = { id: string; display_name: string; avatar_url: string | null; bio?: string };
type TripPreview = { title: string; type: OutingType; distance?: number };
export type PostRow = {
  id: string; user_id: string; spot_id: string | null; trip_id: string | null;
  trip_preview?: TripPreview | null;
  caption: string; created_at: string; likes_count: number; comments_count: number;
};
export type PostPhoto = { id: string; uri: string; thumbnail?: string };
export type SocialPost = PostRow & {
  author?: Profile; photos: PostPhoto[]; liked: boolean; saved: boolean; followed: boolean;
};
export type FeedMode = 'following' | 'nearby';
export const pageSize = 20;

export function requireBackend() {
  if (!backend) throw new Error('Missing backend configuration');
  return backend;
}

function values<T>(result: { data: T | null; error: unknown }) {
  if (result.error) throw result.error;
  return result.data;
}

export async function profilesFor(ids: string[]) {
  if (!ids.length) return new Map<string, Profile>();
  const rows = values(await requireBackend().from('profiles').select('id,display_name,avatar_url')
    .in('id', Array.from(new Set(ids)))) ?? [];
  return new Map(rows.map((row) => [row.id, row as Profile]));
}

export async function decoratePosts(rows: PostRow[], viewer?: string): Promise<SocialPost[]> {
  if (!rows.length) return [];
  const client = requireBackend();
  const ids = rows.map(({ id }) => id);
  const authors = rows.map(({ user_id }) => user_id);
  const [profiles, images, likes, saves, follows] = await Promise.all([
    profilesFor(authors),
    client.from('post_photos').select('id,post_id,url,thumbnail_url').in('post_id', ids).order('position'),
    viewer ? client.from('likes').select('post_id').eq('user_id', viewer).in('post_id', ids) : null,
    viewer ? client.from('saved').select('post_id').in('post_id', ids) : null,
    viewer ? client.from('follows').select('following_id').eq('follower_id', viewer).in('following_id', authors) : null,
  ]);
  const photos = values(images) ?? [];
  const paths = Array.from(new Set(photos.flatMap(({ url, thumbnail_url }) => [url, thumbnail_url])));
  const signed = paths.length ? values(await client.storage.from('post-photos').createSignedUrls(paths, 600)) : [];
  const urls = new Map(signed?.map((item) => [item.path, item.signedUrl]));
  const liked = new Set(likes ? values(likes)?.map(({ post_id }) => post_id) : []);
  const saved = new Set(saves ? values(saves)?.map(({ post_id }) => post_id) : []);
  const followed = new Set(follows ? values(follows)?.map(({ following_id }) => following_id) : []);
  return rows.map((row) => ({
    ...row, author: profiles.get(row.user_id), liked: liked.has(row.id), saved: saved.has(row.id),
    followed: followed.has(row.user_id),
    photos: photos.filter((item) => item.post_id === row.id).flatMap((item) => {
      const uri = urls.get(item.url);
      return uri ? [{ id: item.id, uri, thumbnail: urls.get(item.thumbnail_url) ?? undefined }] : [];
    }),
  }));
}

export async function feedPage(mode: FeedMode, cursor?: Pick<PostRow,'created_at'|'id'>, point?: Point, viewer?: string) {
  const rows = values(await requireBackend().rpc('feed_posts', {
    feed: mode, cursor_at: cursor?.created_at, cursor_id: cursor?.id,
    latitude: point?.latitude, longitude: point?.longitude,
  })) as PostRow[];
  return decoratePosts(rows ?? [], viewer);
}

export async function changeRelation(kind: 'likes' | 'saved' | 'follows', viewer: string, target: string, active: boolean) {
  const client = requireBackend();
  const table = client.from(kind);
  const key = kind === 'follows' ? 'following_id' : 'post_id';
  const owner = kind === 'follows' ? 'follower_id' : 'user_id';
  const result = !active ? await table.delete().eq(key, target).eq(owner, viewer)
    : kind === "follows" ? await table.insert({ following_id: target, follower_id: viewer })
    : await table.insert({ post_id: target });
  if (result.error && !(active && result.error.code === '23505')) throw result.error;
}

export async function publishPost(input: {
  viewer: string; caption: string; audience: 'public' | 'friends'; approximate: boolean;
  spotId?: string; tripId?: string; tripPreview?: TripPreview; point?: Point; photos: Photo[];
}) {
  const client = requireBackend();
  const bucket = client.storage.from('post-photos');
  const uploaded: string[] = [];
  const rows: { url: string; thumbnail_url: string }[] = [];
  try {
    for (const photo of input.photos.slice(0, 10)) {
      if ('sample' in photo) continue;
      const file = photoFile(photo);
      const fileName = `${input.viewer}/${randomUUID()}`;
      const url = `${fileName}.jpg`;
      const thumbnail_url = `${fileName}-thumb.jpg`;
      const resized = await ImageManipulator.manipulate(file.uri).resize({ width: 320 }).renderAsync();
      const thumbnail = new File((await resized.saveAsync({ format: SaveFormat.JPEG, compress: 0.76 })).uri);
      try {
        for (const [path, image] of [[url,file],[thumbnail_url,thumbnail]] as const) {
          const result = await bucket.upload(path, await image.arrayBuffer(), { contentType: 'image/jpeg' });
          if (result.error) throw result.error;
          uploaded.push(path);
        }
        rows.push({ url, thumbnail_url });
      } finally { try { if (thumbnail.exists) thumbnail.delete(); } catch { /* OS-managed cache. */ } }
    }
    const result = await client.rpc('publish_post', {
      message: input.caption, audience: input.audience, approximate: input.approximate,
      attached_spot: input.spotId ?? null, attached_trip: input.tripId ?? null,
      latitude: input.point?.latitude ?? null, longitude: input.point?.longitude ?? null, photos: rows, trip_summary: input.tripPreview ?? null,
    });
    if (result.error) throw result.error;
    return result.data as string;
  } catch (failure) {
    if (uploaded.length) await bucket.remove(uploaded);
    throw failure;
  }
}
