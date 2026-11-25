-- Run as the migration owner against a test database. All fixtures are rolled back.
begin;

insert into auth.users (id, raw_user_meta_data) values
  ('50000000-0000-0000-0000-000000000001','{"full_name":"Reel author"}'),
  ('50000000-0000-0000-0000-000000000002','{"full_name":"Reel reader"}');

set local role authenticated;
set local "request.jwt.claim.sub" = '50000000-0000-0000-0000-000000000001';
insert into storage.objects (bucket_id, name) values
  ('post-videos','50000000-0000-0000-0000-000000000001/a.mp4'),
  ('post-videos','50000000-0000-0000-0000-000000000001/b.mov');

select public.publish_reel('Reel public','public',true,null,null,null,null,null,
  '50000000-0000-0000-0000-000000000001/a.mp4',25000);
select public.publish_reel('Reel friends','friends',true,null,null,null,null,null,
  '50000000-0000-0000-0000-000000000001/b.mov',30000);

do $$
begin
  if (select count(*) from public.post_videos where path like '50000000-%') <> 2 then
    raise exception 'Author cannot access both reels';
  end if;
end $$;

set local "request.jwt.claim.sub" = '50000000-0000-0000-0000-000000000002';
do $$
begin
  if (select count(*) from public.post_videos where path like '50000000-%') <> 1
    or (select count(*) from storage.objects where bucket_id = 'post-videos' and name like '50000000-%') <> 1 then
    raise exception 'Friends-only reel or video exposed';
  end if;
  begin
    perform public.publish_reel('Unauthorized reel','public',true,null,null,null,null,null,
      '50000000-0000-0000-0000-000000000001/a.mp4',25000);
    raise exception 'Reel linked to another user''s file';
  exception when insufficient_privilege then null;
  end;
  if exists (select 1 from public.posts where caption = 'Unauthorized reel') then
    raise exception 'Failed publishing left an empty post';
  end if;
end $$;

reset role;
insert into public.blocks (blocker_id, blocked_id)
values ('50000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000002');
set local role authenticated;
do $$
begin
  if exists (select 1 from public.post_videos where path like '50000000-%')
    or exists (select 1 from storage.objects where bucket_id = 'post-videos' and name like '50000000-%') then
    raise exception 'Blocked reader can access a reel or its file';
  end if;
end $$;

rollback;
