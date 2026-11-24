begin;
insert into auth.users (id,raw_user_meta_data) values
  ('31000000-0000-0000-0000-000000000001','{"full_name":"Owner"}'),
  ('31000000-0000-0000-0000-000000000002','{"full_name":"Reader"}');
set local role authenticated;
set local "request.jwt.claim.sub" = '31000000-0000-0000-0000-000000000001';
select public.create_spot('fishing','Public test','',46.77,23.59,'{}',null,'','',false,'public',true);
select public.create_spot('hike','Private test','',46.77,23.59,'{}',null,'','',false,'private',false);
do $$
begin
  if not exists (select 1 from public.spot_details where name = 'Public test' and abs(latitude - 46.77) < .000001) then
    raise exception 'Spot owner cannot read the exact point';
  end if;
end $$;
set local "request.jwt.claim.sub" = '31000000-0000-0000-0000-000000000002';
do $$
begin
  if exists (select 1 from public.spot_private_locations) then raise exception 'Private point is visible to reader'; end if;
  if exists (select 1 from public.spot_details where name = 'Private test') then raise exception 'Private spot is visible'; end if;
  if not exists (select 1 from public.spots_in_bounds(23.5,46.7,23.7,46.9) s
    where s.name = 'Public test' and abs(s.latitude - 46.77) + abs(s.longitude - 23.59) > .00001)
  then raise exception 'Public spot did not return an obfuscated point'; end if;
end $$;
rollback;
