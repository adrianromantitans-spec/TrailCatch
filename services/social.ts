import { randomUUID } from 'expo-crypto';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { OutingType, Photo, Point } from '../db/model';
import { backend } from './backend';
import { photoFile } from './photos';
import { stripVideoMetadata } from './videoMetadata';

export type Profile = { id: string; display_name: string; avatar_url: string | null; bio?: string };
type TripPreview = { title: string; type: OutingType; distance?: number };
export type PostRow = {
  id: string; user_id: string; spot_id: string | null; trip_id: string | null;
  trip_preview?: TripPreview | null;
  caption: string; created_at: string; likes_count: number; comments_count: number;
};
export type PostPhoto = { id: string; uri: string; thumbnail?: string };
export type PostVideo = { uri: string; durationMs: number };
export type ReelAsset = PostVideo & { extension: 'mp4' | 'mov' };
export type PostComment = { id: string; user_id: string; body: string; created_at: string; author?: Profile };
type CommentPreview = Pick<PostComment, 'id' | 'user_id' | 'body' | 'author'>;
export type SocialPost = PostRow & {
  author?: Profile; photos: PostPhoto[]; video?: PostVideo; latestComment?: CommentPreview;
  liked: boolean; saved: boolean; followed: boolean;
};
export type FeedMode = 'following' | 'nearby';
export const pageSize = 20;
export const maxReelBytes = 20 * 1024 * 1024;
export const maxReelDuration = 30_000;

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

const literalLike = (text: string) => `%${text.trim().replace(/[\\%_]/g, '\\$&')}%`;

export async function searchProfiles(text: string, signal: AbortSignal) {
  const result = await requireBackend().from('profiles').select('id,display_name,avatar_url')
    .ilike('display_name', literalLike(text)).order('display_name').order('id').limit(pageSize).abortSignal(signal);
  return values(result) ?? [];
}

function missingVideoTable(error: { code?: string } | null) {
  return error?.code === 'PGRST205' || error?.code === '42P01';
}

export async function reelsAvailable(signal?: AbortSignal) {
  let request = requireBackend().from('post_videos').select('post_id').limit(1);
  if (signal) request = request.abortSignal(signal);
  const { error } = await request;
  if (missingVideoTable(error)) return false;
  if (error) throw error;
  return true;
}

export async function decoratePosts(rows: PostRow[], viewer?: string, includeVideo = true): Promise<SocialPost[]> {
  if (!rows.length) return [];
  const client = requireBackend();
  const ids = rows.map(({ id }) => id);
  const authors = rows.map(({ user_id }) => user_id);
  const [profiles, images, likes, saves, follows, clips] = await Promise.all([
    profilesFor(authors),
    client.from('post_photos').select('id,post_id,url,thumbnail_url').in('post_id', ids).order('position'),
    viewer ? client.from('likes').select('post_id').eq('user_id', viewer).in('post_id', ids) : null,
    viewer ? client.from('saved').select('post_id').in('post_id', ids) : null,
    viewer ? client.from('follows').select('following_id').eq('follower_id', viewer).in('following_id', authors) : null,
    includeVideo ? client.from('post_videos').select('post_id,path,duration_ms').in('post_id', ids) : null,
  ]);
  const photos = values(images) ?? [];
  const paths = Array.from(new Set(photos.flatMap(({ url, thumbnail_url }) => [url, thumbnail_url])));
  const videos = clips && !missingVideoTable(clips.error) ? values(clips) ?? [] : [];
  const [signed, signedClips] = await Promise.all([
    paths.length ? client.storage.from('post-photos').createSignedUrls(paths, 600).then(values) : [],
    videos.length ? client.storage.from('post-videos').createSignedUrls(videos.map((item) => item.path), 600).then(values) : [],
  ]);
  const urls = new Map(signed?.map((item) => [item.path, item.signedUrl]));
  const clipUrls = new Map(signedClips?.map((item) => [item.path, item.signedUrl]));
  const reelByPost = new Map(videos.flatMap(({ post_id, path, duration_ms }) => {
    const uri = clipUrls.get(path);
    return uri ? [[post_id, { uri, durationMs: duration_ms }] as const] : [];
  }));
  const liked = new Set(likes ? values(likes)?.map(({ post_id }) => post_id) : []);
  const saved = new Set(saves ? values(saves)?.map(({ post_id }) => post_id) : []);
  const followed = new Set(follows ? values(follows)?.map(({ following_id }) => following_id) : []);
  return rows.map((row) => ({
    ...row, author: profiles.get(row.user_id), liked: liked.has(row.id), saved: saved.has(row.id),
    followed: followed.has(row.user_id), video: reelByPost.get(row.id),
    photos: photos.filter((item) => item.post_id === row.id).flatMap((item) => {
      const uri = urls.get(item.url);
      return uri ? [{ id: item.id, uri, thumbnail: urls.get(item.thumbnail_url) ?? undefined }] : [];
    }),
  }));
}

export async function discoveryPage(text: string, mode: 'posts' | 'reels', hasReels: boolean, viewer?: string,
  cursor?: Pick<PostRow, 'created_at' | 'id'>, signal?: AbortSignal) {
  const columns = 'id,user_id,spot_id,trip_id,trip_preview,caption,created_at,likes_count,comments_count';
  let request = requireBackend().from('posts').select(hasReels ? `${columns},post_videos(post_id)` : columns)
    .eq('visibility', 'public').eq('deleted', false)
    .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(pageSize);
  if (viewer) request = request.neq('user_id', viewer);
  if (hasReels) request = mode === 'reels' ? request.not('post_videos', 'is', null) : request.is('post_videos', null);
  if (signal) request = request.abortSignal(signal);
  const conditions: string[] = [];
  if (text) {
    const value = `"${literalLike(text).replace(/[\\"]/g, '\\$&')}"`;
    conditions.push(`or(caption.ilike.${value},trip_preview->>title.ilike.${value})`);
  }
  if (cursor) conditions.push(`or(created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id}))`);
  if (conditions.length) request = request.or(`and(${conditions.join(',')})`);
  const rows = values(await request) as unknown as PostRow[] ?? [];
  return decoratePosts(rows, viewer, mode === 'reels');
}

export async function feedPage(mode: FeedMode, cursor?: Pick<PostRow,'created_at'|'id'>, point?: Point, viewer?: string) {
  const rows = values(await requireBackend().rpc('feed_posts', {
    feed: mode, cursor_at: cursor?.created_at, cursor_id: cursor?.id,
    latitude: point?.latitude, longitude: point?.longitude,
  })) as PostRow[];
  const [posts, previews] = await Promise.all([
    decoratePosts(rows ?? [], viewer),
    commentPreviews((rows ?? []).filter((post) => post.comments_count > 0).map(({ id }) => id)).catch(() => new Map<string, CommentPreview>()),
  ]);
  return posts.map((post) => ({ ...post, latestComment: previews.get(post.id) }));
}

async function commentPreviews(ids: string[]) {
  if (!ids.length) return new Map<string, CommentPreview>();
  const result = await requireBackend().from('posts').select('id,comments(id,user_id,body)').in('id', ids)
    .is('comments.parent_id', null).order('created_at', { referencedTable: 'comments', ascending: false })
    .order('id', { referencedTable: 'comments', ascending: false }).limit(1, { referencedTable: 'comments' });
  const comments = (values(result) ?? []).flatMap(({ id, comments }) => comments[0] ? [[id, comments[0]] as const] : []);
  const authors = await profilesFor(comments.map(([, comment]) => comment.user_id));
  return new Map(comments.map(([id, comment]) => [id, { ...comment, author: authors.get(comment.user_id) }]));
}

export async function commentsPage(postId: string, parent: string | null, cursor?: PostComment, signal?: AbortSignal) {
  let query = requireBackend().from('comments').select('id,user_id,body,created_at').eq('post_id', postId)
    .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(pageSize);
  query = parent ? query.eq('parent_id', parent) : query.is('parent_id', null);
  if (cursor) query = query.or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`);
  if (signal) query = query.abortSignal(signal);
  const posts = values(await query) ?? [];
  const authors = await profilesFor(posts.map(({ user_id }) => user_id));
  return posts.map((post) => ({ ...post, author: authors.get(post.user_id) }));
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

export async function publishReel(input: Parameters<typeof publishPost>[0], reel: ReelAsset) {
  const client = requireBackend();
  const file = new File(reel.uri);
  const durationMs = Math.round(reel.durationMs);
  if (!file.size || file.size > maxReelBytes || !Number.isFinite(durationMs) ||
      durationMs < 1 || durationMs > maxReelDuration) throw new Error('Invalid video');
  const data = stripVideoMetadata(await file.arrayBuffer());
  const path = `${input.viewer}/${randomUUID()}.${reel.extension}`;
  const bucket = client.storage.from('post-videos');
  const result = await bucket.upload(path, data, { contentType: reel.extension === 'mov' ? 'video/quicktime' : 'video/mp4' });
  if (result.error) throw result.error;
  const published = await client.rpc('publish_reel', {
    message: input.caption, audience: input.audience, approximate: input.approximate,
    attached_spot: input.spotId ?? null, attached_trip: input.tripId ?? null, trip_summary: input.tripPreview ?? null,
    latitude: input.point?.latitude ?? null, longitude: input.point?.longitude ?? null, video_path: path, duration_ms: durationMs,
  });
  if (!published.error) return published.data as string;
  if (published.status >= 400 && published.status < 500) await bucket.remove([path]);
  else {
    // A lost response may follow a successful commit. Preserve the file and check whether it was published.
    const existing = await client.from('post_videos').select('post_id').eq('path', path).maybeSingle();
    if (existing.data) return existing.data.post_id as string;
  }
  throw published.error;
}
