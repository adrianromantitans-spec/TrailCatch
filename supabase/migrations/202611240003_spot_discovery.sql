create view public.spot_details with (security_invoker = true) as
select s.id,s.user_id,s.type,s.name,s.description,s.species,s.difficulty,s.season,s.directions,
  s.requires_permit,s.visibility,s.approximate_location,s.origin,s.created_at,
  extensions.st_y(coalesce(p.location,s.location)::extensions.geometry) as latitude,
  extensions.st_x(coalesce(p.location,s.location)::extensions.geometry) as longitude
from public.spots s left join public.spot_private_locations p on p.spot_id = s.id;
grant select on public.spot_details to anon,authenticated;
grant select on public.spot_private_locations to anon;

create function public.spots_in_bounds(
  west double precision, south double precision, east double precision, north double precision,
  spot_type text default null, target_species text default null, target_difficulty text default null
) returns setof public.spot_details language sql stable security invoker set search_path = '' as $$
  select d.* from public.spot_details d join public.spots s on s.id = d.id
  where s.visibility = 'public'
    and west between -180 and 180 and east between -180 and 180 and north between -90 and 90 and south between -90 and 90 and north >= south
    and (
      (east >= west and s.location::extensions.geometry operator(extensions.&&) extensions.st_makeenvelope(west,south,east,north,4326))
      or (east < west and (
        s.location::extensions.geometry operator(extensions.&&) extensions.st_makeenvelope(west,south,180,north,4326)
        or s.location::extensions.geometry operator(extensions.&&) extensions.st_makeenvelope(-180,south,east,north,4326)
      ))
    )
    and (spot_type is null or s.type = spot_type or s.type = 'both')
    and (target_species is null or target_species = any(s.species))
    and (target_difficulty is null or s.difficulty = target_difficulty)
  order by s.created_at desc,s.id desc limit 200;
$$;
create index spots_geometry_location on public.spots using gist ((location::extensions.geometry)) where visibility = 'public';

create or replace function private.reported_spot(spot uuid, photo uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.reports where reporter_id = (select auth.uid())
    and (spot_id = spot or spot_photo_id = photo));
$$;
alter policy spots_read on public.spots using (
  not private.reported_spot(id,null) and
  (user_id = (select auth.uid()) or (not private.is_blocked(user_id) and
    (visibility = 'public' or (visibility = 'friends' and private.are_friends(user_id)))))
);
alter policy spot_photos_read on public.spot_photos using (
  not private.reported_spot(null,id) and exists(select 1 from public.spots where id = spot_id)
);
alter policy reports_add on public.reports with check (
  reporter_id = (select auth.uid()) and (
    (target_user_id is not null and target_user_id <> (select auth.uid())
      and exists (select 1 from public.profiles where id = target_user_id)) or
    (spot_id is not null and exists (select 1 from public.spots where id = spot_id)) or
    (spot_photo_id is not null and exists (select 1 from public.spot_photos where id = spot_photo_id)) or
    (post_id is not null and exists (select 1 from public.posts where id = post_id)) or
    (comment_id is not null and exists (select 1 from public.comments where id = comment_id))
  )
);
