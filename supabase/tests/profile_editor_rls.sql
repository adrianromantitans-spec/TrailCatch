begin;

insert into auth.users (id, raw_user_meta_data) values
  ('60000000-0000-0000-0000-000000000001','{"full_name":"New profile"}'),
  ('60000000-0000-0000-0000-000000000002','{"full_name":"Other profile"}');

set local role authenticated;
set local "request.jwt.claim.sub" = '60000000-0000-0000-0000-000000000001';

do $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and not onboarding_complete) then
    raise exception 'New account must be offered profile setup';
  end if;
  if not public.profile_username_available('trailcatch_test') then raise exception 'Available username rejected'; end if;
  if public.profile_username_available('Invalid!') then raise exception 'Invalid username accepted'; end if;
end $$;

insert into storage.objects (bucket_id,name) values ('avatars','60000000-0000-0000-0000-000000000001/a.jpg');
update public.profiles set username = 'trailcatch_test', onboarding_complete = true where id = auth.uid();

set local "request.jwt.claim.sub" = '60000000-0000-0000-0000-000000000002';
do $$
begin
  if public.profile_username_available('trailcatch_test') then raise exception 'Taken username returned as available'; end if;
  begin
    update public.profiles set username = 'trailcatch_test' where id = auth.uid();
    raise exception 'Duplicate username accepted';
  exception when unique_violation then null;
  end;
  begin
    insert into storage.objects (bucket_id,name) values ('avatars','60000000-0000-0000-0000-000000000001/b.jpg');
    raise exception 'Cross-account avatar upload allowed';
  exception when insufficient_privilege then null;
  end;
  delete from storage.objects where bucket_id = 'avatars' and name = '60000000-0000-0000-0000-000000000001/a.jpg';
  if found then raise exception 'Cross-account avatar deletion allowed'; end if;
end $$;

rollback;
