create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  spot_id uuid references public.spots on delete set null,
  trip_id text check (char_length(trip_id) <= 128),
  caption text not null default '' check (char_length(caption) <= 2200),
  approximate_location boolean not null default true,
  location extensions.geography(Point,4326),
  visibility text not null default 'public' check (visibility in ('public','friends')),
  created_at timestamptz not null default now(),
  deleted boolean not null default false,
  likes_count integer not null default 0 check (likes_count >= 0),
  comments_count integer not null default 0 check (comments_count >= 0)
);
create index posts_created on public.posts (created_at desc,id desc) where not deleted;
create index posts_author_created on public.posts (user_id,created_at desc,id desc) where not deleted;
create index posts_location on public.posts using gist (location) where not deleted and location is not null;

create function private.prepare_post_location() returns trigger
language plpgsql set search_path = '' as $$
declare linked public.spots;
begin
  if new.spot_id is not null then
    select * into linked from public.spots where id = new.spot_id;
    if not found or linked.visibility = 'private' or
      (new.visibility = 'public' and linked.visibility <> 'public') then
      raise exception 'invalid linked spot' using errcode = '23514';
    end if;
    if tg_op = 'INSERT' then
      new.location := linked.location;
      new.approximate_location := new.approximate_location or linked.approximate_location;
    end if;
  end if;
  if tg_op = 'INSERT' and new.approximate_location and new.location is not null then
    new.location := extensions.st_snaptogrid(new.location::extensions.geometry, 0.01)::extensions.geography;
  end if;
  return new;
end;
$$;
create trigger post_location before insert or update of spot_id, visibility on public.posts
for each row execute function private.prepare_post_location();

create table public.post_photos (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts on delete cascade,
  url text not null,
  thumbnail_url text not null,
  position smallint not null check (position between 0 and 9),
  unique (post_id,position)
);
create table public.likes (
  post_id uuid references public.posts on delete cascade,
  user_id uuid default auth.uid() references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key(post_id,user_id)
);
create index likes_user on public.likes (user_id);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  parent_id uuid,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now(),
  deleted boolean not null default false,
  unique (id,post_id),
  foreign key (parent_id,post_id) references public.comments(id,post_id) on delete cascade
);
create index comments_post_cursor on public.comments (post_id,parent_id,created_at desc,id desc);
create index comments_user_rate on public.comments (user_id,created_at desc);

create table public.saved (
  user_id uuid default auth.uid() references public.profiles on delete cascade,
  post_id uuid references public.posts on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id,post_id)
);
create index saved_cursor on public.saved (user_id,created_at desc,post_id desc);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  type text not null check (type in ('like','comment','follower')),
  actor_id uuid not null references public.profiles on delete cascade,
  post_id uuid references public.posts on delete cascade,
  read boolean not null default false,
  created_at timestamptz not null default now(),
  check ((type = 'follower') = (post_id is null)),
  check (user_id <> actor_id)
);
create index notifications_user_cursor on public.notifications (user_id,created_at desc,id desc);
create unique index notifications_unread_group on public.notifications (user_id,type,post_id) nulls not distinct where not read;

create table public.push_tokens (
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  token text primary key check (token ~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$'),
  platform text not null check (platform in ('ios','android'))
);
create index push_tokens_user on public.push_tokens(user_id);

alter table public.reports
  add column post_id uuid references public.posts on delete cascade,
  add column comment_id uuid references public.comments on delete cascade,
  drop constraint reports_target,
  add constraint reports_target check (num_nonnulls(target_user_id,spot_id,spot_photo_id,post_id,comment_id) = 1);
create unique index reports_post_once on public.reports(reporter_id,post_id) where post_id is not null;
create unique index reports_comment_once on public.reports(reporter_id,comment_id) where comment_id is not null;

create function private.reported_content(post uuid, comment uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.reports where reporter_id = (select auth.uid())
    and (post_id = post or comment_id = comment));
$$;

alter table public.posts enable row level security;
alter table public.post_photos enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;
alter table public.saved enable row level security;
alter table public.notifications enable row level security;
alter table public.push_tokens enable row level security;

create policy posts_read on public.posts for select using (
  not deleted and not private.reported_content(id,null) and
  (user_id = (select auth.uid()) or (not private.is_blocked(user_id) and
     (visibility = 'public' or (visibility = 'friends' and private.are_friends(user_id)))))
);
create policy posts_create on public.posts for insert to authenticated with check (user_id = (select auth.uid()));
create policy posts_update on public.posts for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy posts_remove on public.posts for delete to authenticated using (user_id = (select auth.uid()));
create policy post_photos_read on public.post_photos for select using (exists (select 1 from public.posts where id = post_id));
create policy post_photos_write on public.post_photos for all to authenticated
using (exists (select 1 from public.posts where id = post_id and user_id = (select auth.uid())))
with check (
  exists (select 1 from public.posts where id = post_id and user_id = (select auth.uid()))
  and split_part(url,'/',1) = (select auth.uid())::text and split_part(thumbnail_url,'/',1) = (select auth.uid())::text
);

create policy likes_read on public.likes for select using (
  not private.is_blocked(user_id) and exists (select 1 from public.posts where id = post_id)
);
create policy likes_create on public.likes for insert to authenticated with check (
  user_id = (select auth.uid()) and exists (select 1 from public.posts where id = post_id)
);
create policy likes_remove on public.likes for delete to authenticated using (user_id = (select auth.uid()));
create policy comments_read on public.comments for select using (
  not deleted and not private.is_blocked(user_id) and not private.reported_content(null,id)
  and exists (select 1 from public.posts where id = post_id)
);
create policy comments_create on public.comments for insert to authenticated with check (
  user_id = (select auth.uid()) and exists (select 1 from public.posts where id = post_id)
);
create policy comments_update on public.comments for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy saved_read on public.saved for select to authenticated using (
  user_id = (select auth.uid()) and exists (select 1 from public.posts where id = post_id)
);
create policy saved_create on public.saved for insert to authenticated with check (
  user_id = (select auth.uid()) and exists (select 1 from public.posts where id = post_id)
);
create policy saved_remove on public.saved for delete to authenticated using (user_id = (select auth.uid()));
create policy notifications_read on public.notifications for select to authenticated using (
  user_id = (select auth.uid()) and not private.is_blocked(actor_id)
  and (post_id is null or exists (select 1 from public.posts where id = post_id))
);
create policy notifications_update on public.notifications for update to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy push_tokens_owner on public.push_tokens for all to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on public.posts,public.post_photos,public.likes,public.comments,public.saved,public.notifications,public.push_tokens from anon,authenticated;
grant select on public.posts,public.post_photos,public.likes,public.comments to anon,authenticated;
grant insert (id,spot_id,trip_id,caption,approximate_location,location,visibility), update (caption,visibility), delete on public.posts to authenticated;
grant insert,update,delete on public.post_photos to authenticated;
grant insert (post_id),delete on public.likes to authenticated;
grant insert (post_id,parent_id,body),update (body) on public.comments to authenticated;
grant select,delete on public.saved to authenticated;
grant insert (post_id) on public.saved to authenticated;
grant select on public.notifications to authenticated;
grant update (read) on public.notifications to authenticated;
grant select,delete on public.push_tokens to authenticated;
grant insert (token,platform),update (platform) on public.push_tokens to authenticated;

-- A soft-deleted row is hidden immediately by SELECT RLS.
create function public.delete_own_comment(comment uuid) returns void
language sql security definer set search_path = '' as $$
  update public.comments set deleted = true where id = comment and user_id = (select auth.uid()) and not deleted;
$$;
create function public.delete_own_post(post uuid) returns void
language sql security definer set search_path = '' as $$
  update public.posts set deleted = true where id = post and user_id = (select auth.uid()) and not deleted;
$$;
revoke all on function public.delete_own_comment(uuid),public.delete_own_post(uuid) from public;
grant execute on function public.delete_own_comment(uuid),public.delete_own_post(uuid) to authenticated;

create function private.comment_limits() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text,0));
  if (select count(*) from public.comments where user_id = new.user_id and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'comment rate limit' using errcode = 'P0001';
  end if;
  if new.parent_id is not null and not exists (
    select 1 from public.comments where id = new.parent_id and post_id = new.post_id and parent_id is null
      and not deleted and not private.is_blocked(user_id) and not private.reported_content(null,id)
  ) then raise exception 'invalid reply' using errcode = '23514'; end if;
  return new;
end;
$$;
create trigger comments_limit before insert on public.comments for each row execute function private.comment_limits();

create function private.update_post_count() returns trigger language plpgsql security definer set search_path = '' as $$
declare target uuid;
declare change integer;
begin
  if tg_op = 'DELETE' then target := old.post_id; else target := new.post_id; end if;
  if tg_table_name = 'likes' then
    update public.posts set likes_count = likes_count + case when tg_op = 'INSERT' then 1 else -1 end where id = target;
  else
    change := case tg_op
      when 'INSERT' then (not new.deleted)::integer
      when 'DELETE' then -((not old.deleted)::integer)
      else (not new.deleted)::integer - (not old.deleted)::integer
    end;
    if change <> 0 then update public.posts set comments_count = comments_count + change where id = target; end if;
  end if;
  return null;
end;
$$;
create trigger likes_count after insert or delete on public.likes for each row execute function private.update_post_count();
create trigger comments_count after insert or delete or update of deleted on public.comments for each row execute function private.update_post_count();

create function private.add_notification() returns trigger language plpgsql security definer set search_path = '' as $$
declare recipient uuid;
declare actor uuid;
declare related_post uuid;
declare event_type text;
begin
  if tg_table_name = 'follows' then
    recipient := new.following_id; actor := new.follower_id; event_type := 'follower';
  else
    related_post := new.post_id; actor := new.user_id;
    select user_id into recipient from public.posts where id = related_post;
    event_type := case tg_table_name when 'likes' then 'like' else 'comment' end;
  end if;
  if recipient is not null and recipient <> actor then
    insert into public.notifications(user_id,type,actor_id,post_id)
    values (recipient,event_type,actor,related_post)
    on conflict (user_id,type,post_id) where not read
    do update set actor_id = excluded.actor_id, created_at = now();
  end if;
  return null;
end;
$$;
create trigger notify_follow after insert on public.follows for each row execute function private.add_notification();
create trigger notify_like after insert on public.likes for each row execute function private.add_notification();
create trigger notify_comment after insert on public.comments for each row execute function private.add_notification();

create function public.feed_posts(feed text, cursor_at timestamptz default null, cursor_id uuid default null,
  latitude double precision default null, longitude double precision default null)
returns setof public.posts language sql stable security invoker set search_path = '' as $$
  select p.* from public.posts p
  where not p.deleted
    and (cursor_at is null or (p.created_at,p.id) < (cursor_at,cursor_id))
    and case feed
      when 'following' then p.user_id = (select auth.uid()) or exists (
        select 1 from public.follows f where f.follower_id = (select auth.uid()) and f.following_id = p.user_id
      )
      when 'nearby' then case when latitude between -90 and 90 and longitude between -180 and 180 then
        extensions.st_dwithin(p.location,
          extensions.st_setsrid(extensions.st_makepoint(longitude,latitude),4326)::extensions.geography,50000)
        else false end
      else false
    end
  order by p.created_at desc,p.id desc limit 20;
$$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('post-photos','post-photos',false,10485760,array['image/jpeg']) on conflict (id) do nothing;
create policy post_storage_upload on storage.objects for insert to authenticated
with check (bucket_id = 'post-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy post_storage_delete on storage.objects for delete to authenticated
using (bucket_id = 'post-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy post_storage_read on storage.objects for select
using (bucket_id = 'post-photos' and (
  (storage.foldername(name))[1] = (select auth.uid())::text
  or exists (select 1 from public.post_photos p where p.url = name or p.thumbnail_url = name)
));
