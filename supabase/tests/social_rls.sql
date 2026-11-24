-- Run as the migration owner against a test database. All fixtures are rolled back.
begin;
insert into auth.users (id,raw_user_meta_data) values
  ('10000000-0000-0000-0000-000000000001','{"full_name":"Author"}'),
  ('10000000-0000-0000-0000-000000000002','{"full_name":"Reader"}'),
  ('10000000-0000-0000-0000-000000000003','{"full_name":"Other"}');
insert into public.posts (id,user_id,visibility) values
  ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','friends'),
  ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','public');
insert into public.follows (follower_id,following_id)
values ('10000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001');

set local role authenticated;
set local "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000002';
do $$
begin
  if (select count(*) from public.posts) <> 1 then
    raise exception 'A one-way follow must not expose friends-only posts';
  end if;
  if (select count(*) from public.feed_posts('following')) <> 1 then
    raise exception 'Following feed must apply the post visibility policy';
  end if;
end $$;

reset role;
insert into public.follows (follower_id,following_id)
values ('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002');

set local role authenticated;
do $$
begin
  if (select count(*) from public.posts) <> 2 then
    raise exception 'Mutual follows must expose friends-only posts';
  end if;
end $$;
do $$
declare published uuid;
begin
  published := public.publish_post('Nearby test','public',true,null,'local-trip',46.771,23.591,
    '[{"url":"10000000-0000-0000-0000-000000000002/a.jpg","thumbnail_url":"10000000-0000-0000-0000-000000000002/a-thumb.jpg"}]');
  if not exists (select 1 from public.feed_posts('nearby', null, null,46.77,23.59) where id = published) then
    raise exception 'Nearby feed did not include the approximate location';
  end if;
  if not exists(select 1 from public.post_photos where post_id = published) then raise exception 'Publication lost its photo'; end if;
  perform public.delete_own_post(published);
end $$;
insert into public.likes (post_id) values ('20000000-0000-0000-0000-000000000002');
insert into public.comments (post_id,body) values ('20000000-0000-0000-0000-000000000002','Test');
do $$
begin
  if not exists (select 1 from public.posts where id = '20000000-0000-0000-0000-000000000002'
    and likes_count = 1 and comments_count = 1) then raise exception 'Counters not updated'; end if;
end $$;
select public.delete_own_comment((select id from public.comments where body = 'Test'));
do $$
begin
  if exists (select 1 from public.comments where body = 'Test') then raise exception 'Deleted comment still visible'; end if;
  if exists (select 1 from public.posts where comments_count <> 0) then raise exception 'Soft deletion did not update count'; end if;
end $$;
do $$
declare root_comment uuid;
declare reply_comment uuid;
begin
  insert into public.comments (post_id,body) values ('20000000-0000-0000-0000-000000000002','Root')
    returning id into root_comment;
  insert into public.comments (post_id,parent_id,body)
    values ('20000000-0000-0000-0000-000000000002',root_comment,'Reply') returning id into reply_comment;
  begin
    insert into public.comments (post_id,parent_id,body)
      values ('20000000-0000-0000-0000-000000000002',reply_comment,'Nested');
    raise exception 'Second-level reply accepted';
  exception when check_violation then null;
  end;
  insert into public.comments (post_id,body)
    select '20000000-0000-0000-0000-000000000002','Rate' from generate_series(1,27);
  begin
    insert into public.comments (post_id,body) values ('20000000-0000-0000-0000-000000000002','Over limit');
    raise exception 'Rate limit not applied' using errcode = 'P9999';
  exception when raise_exception then
    if sqlerrm <> 'comment rate limit' then raise; end if;
  end;
end $$;
insert into public.reports (post_id,reason)
values ('20000000-0000-0000-0000-000000000002','Test');
do $$
begin
  if exists (select 1 from public.posts where id = '20000000-0000-0000-0000-000000000002') then
    raise exception 'Reported post still visible to reporter';
  end if;
end $$;

reset role;
insert into public.blocks (blocker_id,blocked_id)
values ('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002');
set local role authenticated;
do $$
begin
  if exists (select 1 from public.posts) then raise exception 'Viewer can see posts from someone who blocked them'; end if;
end $$;
set local "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000001';
do $$
begin
  if exists (select 1 from public.profiles where id = '10000000-0000-0000-0000-000000000002') then
    raise exception 'Block did not hide other user from blocker';
  end if;
end $$;
reset role;
set local role anon;
set local "request.jwt.claim.sub" = '';
do $$
begin
  if (select count(*) from public.posts) <> 1 then raise exception 'Anonymous public visibility is incorrect'; end if;
end $$;
rollback;
