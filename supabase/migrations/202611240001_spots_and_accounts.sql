create schema if not exists extensions;
create extension if not exists postgis with schema extensions;
grant usage on schema extensions to anon, authenticated;
create schema if not exists private;

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  bio text not null default '' check (char_length(bio) <= 500),
  avatar_url text,
  created_at timestamptz not null default now()
);

create function private.create_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(left(btrim(new.raw_user_meta_data ->> 'full_name'), 80), ''), 'TrailCatch'))
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger trailcatch_create_profile after insert on auth.users
for each row execute function private.create_profile();
insert into public.profiles (id, display_name)
select id, coalesce(nullif(left(btrim(raw_user_meta_data ->> 'full_name'), 80), ''), 'TrailCatch')
from auth.users on conflict (id) do nothing;

create table public.blocks (
  blocker_id uuid references public.profiles on delete cascade,
  blocked_id uuid references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create table public.follows (
  follower_id uuid references public.profiles on delete cascade,
  following_id uuid references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);
create index follows_following_created on public.follows (following_id, created_at desc);

create function private.is_blocked(author uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = (select auth.uid()) and blocked_id = author)
       or (blocker_id = author and blocked_id = (select auth.uid()))
  );
$$;
create function private.are_friends(author uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.follows where follower_id = (select auth.uid()) and following_id = author)
     and exists (select 1 from public.follows where follower_id = author and following_id = (select auth.uid()));
$$;

create table public.spots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  type text not null check (type in ('fishing','hike','both')),
  name text not null check (char_length(name) between 1 and 120),
  description text not null default '',
  species text[] not null default '{}',
  difficulty text check (difficulty in ('easy','moderate','hard')),
  season text not null default '',
  directions text not null default '',
  requires_permit boolean not null default false,
  visibility text not null default 'private' check (visibility in ('private','friends','public')),
  approximate_location boolean not null default false,
  location extensions.geography(Point,4326) not null,
  origin text,
  origin_id text,
  created_at timestamptz not null default now(),
  unique (origin,origin_id)
);
create index spots_location on public.spots using gist (location);
create index spots_author_created on public.spots (user_id, created_at desc, id desc);

create table public.spot_private_locations (
  spot_id uuid primary key references public.spots on delete cascade,
  location extensions.geography(Point,4326) not null
);

create function public.create_spot(
  spot_type text, spot_name text, spot_description text, latitude double precision, longitude double precision,
  spot_species text[], spot_difficulty text, spot_season text, spot_directions text,
  permit boolean, spot_visibility text, approximate boolean
) returns uuid language plpgsql security definer set search_path = '' as $$
declare owner_id uuid := auth.uid();
declare exact_point extensions.geography;
declare spot_id uuid;
begin
  if owner_id is null then raise exception 'authentication required'; end if;
  if latitude is null or longitude is null or latitude not between -90 and 90 or longitude not between -180 and 180 then
    raise exception 'invalid location';
  end if;
  exact_point := extensions.st_setsrid(extensions.st_makepoint(longitude,latitude),4326)::extensions.geography;
  insert into public.spots(user_id,type,name,description,location,species,difficulty,season,directions,requires_permit,visibility,approximate_location)
  values (owner_id,spot_type,btrim(spot_name),spot_description,
    case when approximate then extensions.st_project(exact_point,500,random()*2*pi()) else exact_point end,
    spot_species,spot_difficulty,spot_season,spot_directions,permit,spot_visibility,approximate)
  returning id into spot_id;
  insert into public.spot_private_locations values (spot_id, exact_point);
  return spot_id;
end;
$$;
revoke all on function public.create_spot(text,text,text,double precision,double precision,text[],text,text,text,boolean,text,boolean) from public;
grant execute on function public.create_spot(text,text,text,double precision,double precision,text[],text,text,text,boolean,text,boolean) to authenticated;

create table public.spot_photos (
  id uuid primary key default gen_random_uuid(),
  spot_id uuid not null references public.spots on delete cascade,
  url text not null,
  thumbnail_url text not null,
  position smallint not null check (position between 0 and 4),
  unique (spot_id,position)
);
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references public.profiles on delete cascade,
  target_user_id uuid references public.profiles on delete cascade,
  spot_id uuid references public.spots on delete cascade,
  spot_photo_id uuid references public.spot_photos on delete cascade,
  reason text not null check (char_length(btrim(reason)) between 1 and 1000),
  created_at timestamptz not null default now(),
  constraint reports_target check (num_nonnulls(target_user_id, spot_id, spot_photo_id) = 1)
);
create index reports_reporter on public.reports (reporter_id);

alter table public.profiles enable row level security;
alter table public.blocks enable row level security;
alter table public.follows enable row level security;
alter table public.spots enable row level security;
alter table public.spot_private_locations enable row level security;
alter table public.spot_photos enable row level security;
alter table public.reports enable row level security;

create policy profiles_read on public.profiles for select using (not private.is_blocked(id));
create policy profiles_write on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy blocks_read on public.blocks for select to authenticated using (blocker_id = (select auth.uid()));
create policy blocks_add on public.blocks for insert to authenticated with check (blocker_id = (select auth.uid()));
create policy blocks_remove on public.blocks for delete to authenticated using (blocker_id = (select auth.uid()));
create policy follows_read on public.follows for select using (not private.is_blocked(follower_id) and not private.is_blocked(following_id));
create policy follows_add on public.follows for insert to authenticated
with check (follower_id = (select auth.uid()) and not private.is_blocked(following_id));
create policy follows_remove on public.follows for delete to authenticated using (follower_id = (select auth.uid()));
create policy spots_read on public.spots for select using (
  user_id = (select auth.uid()) or (not private.is_blocked(user_id) and
    (visibility = 'public' or (visibility = 'friends' and private.are_friends(user_id))))
);
create policy spots_update on public.spots for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy spots_delete on public.spots for delete to authenticated using (user_id = (select auth.uid()));
create policy exact_spot_owner on public.spot_private_locations for select to authenticated using (
  exists(select 1 from public.spots s where s.id = spot_id and s.user_id = (select auth.uid()))
);
create policy spot_photos_read on public.spot_photos for select using (exists(select 1 from public.spots where id = spot_id));
create policy spot_photos_write on public.spot_photos for all to authenticated
using (exists(select 1 from public.spots where id = spot_id and user_id = (select auth.uid())))
with check (
  exists(select 1 from public.spots where id = spot_id and user_id = (select auth.uid()))
  and split_part(url,'/',1) = (select auth.uid())::text and split_part(thumbnail_url,'/',1) = (select auth.uid())::text
);
create policy reports_read on public.reports for select to authenticated
using (reporter_id = (select auth.uid()) or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy reports_add on public.reports for insert to authenticated with check (reporter_id = (select auth.uid()));

revoke all on public.profiles,public.blocks,public.follows,public.spots,public.spot_private_locations,public.spot_photos,public.reports from anon,authenticated;
grant select on public.profiles,public.follows,public.spots,public.spot_photos to anon,authenticated;
grant update (display_name,bio,avatar_url) on public.profiles to authenticated;
grant update (type,name,description,species,difficulty,season,directions,requires_permit,visibility) on public.spots to authenticated;
grant delete on public.spots to authenticated;
grant select on public.spot_private_locations to authenticated;
grant select,insert,delete on public.blocks to authenticated;
grant insert,delete on public.follows to authenticated;
grant insert,update,delete on public.spot_photos to authenticated;
grant select,insert on public.reports to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('spot-photos','spot-photos',false,10485760,array['image/jpeg']) on conflict (id) do nothing;
create policy spot_storage_upload on storage.objects for insert to authenticated
with check (bucket_id = 'spot-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy spot_storage_delete on storage.objects for delete to authenticated
using (bucket_id = 'spot-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy spot_storage_read on storage.objects for select
using (bucket_id = 'spot-photos' and (
  (storage.foldername(name))[1] = (select auth.uid())::text
  or exists (select 1 from public.spot_photos p where p.url = name or p.thumbnail_url = name)
));
