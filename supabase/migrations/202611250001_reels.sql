create table public.post_videos (
  post_id uuid primary key references public.posts on delete cascade,
  path text not null unique,
  duration_ms integer not null check (duration_ms between 1 and 30000)
);

alter table public.post_videos enable row level security;
grant select on public.post_videos to anon, authenticated;
grant insert on public.post_videos to authenticated;

create policy post_videos_read on public.post_videos for select
using (exists (select 1 from public.posts p where p.id = post_id));

create function private.owns_reel_file(video_path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from storage.objects o where o.bucket_id = 'post-videos' and o.name = video_path
      and (storage.foldername(o.name))[1] = (select auth.uid())::text
  );
$$;
revoke all on function private.owns_reel_file(text) from public;
grant execute on function private.owns_reel_file(text) to authenticated;

create policy post_videos_insert on public.post_videos for insert to authenticated
with check (
  path ~ ('^' || (select auth.uid())::text || '/[0-9a-f-]+\.(mp4|mov)$')
  and exists (select 1 from public.posts p where p.id = post_id and p.user_id = (select auth.uid()))
  and private.owns_reel_file(path)
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-videos', 'post-videos', false, 20971520, array['video/mp4','video/quicktime'])
on conflict (id) do nothing;

create policy video_storage_upload on storage.objects for insert to authenticated
with check (bucket_id = 'post-videos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy video_storage_read on storage.objects for select
using (bucket_id = 'post-videos' and (
  (storage.foldername(name))[1] = (select auth.uid())::text
  or exists (select 1 from public.post_videos video where video.path = name)
));

create policy video_storage_delete on storage.objects for delete to authenticated
using (bucket_id = 'post-videos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create function public.publish_reel(
  message text, audience text, approximate boolean, attached_spot uuid, attached_trip text,
  latitude double precision, longitude double precision, trip_summary jsonb, video_path text, duration_ms integer
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare post uuid;
declare location extensions.geography;
begin
  if latitude between -90 and 90 and longitude between -180 and 180 then
    location := extensions.st_setsrid(extensions.st_makepoint(longitude,latitude),4326)::extensions.geography;
  end if;
  insert into public.posts (caption,visibility,approximate_location,spot_id,trip_id,location,trip_preview)
  values (message,audience,approximate,attached_spot,attached_trip,location,trip_summary)
  returning id into post;
  insert into public.post_videos (post_id,path,duration_ms) values (post,video_path,duration_ms);
  return post;
end;
$$;
revoke all on function public.publish_reel(text,text,boolean,uuid,text,double precision,double precision,jsonb,text,integer) from public;
grant execute on function public.publish_reel(text,text,boolean,uuid,text,double precision,double precision,jsonb,text,integer) to authenticated;
