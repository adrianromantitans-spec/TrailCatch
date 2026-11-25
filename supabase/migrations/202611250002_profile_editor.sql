alter table public.profiles
  add column username text check (username ~ '^[a-z0-9_]{3,24}$'),
  add column onboarding_complete boolean not null default true;

alter table public.profiles alter column onboarding_complete set default false;
create unique index profiles_username_unique on public.profiles (username) where username is not null;
grant update (username, onboarding_complete) on public.profiles to authenticated;

create function public.profile_username_available(candidate text) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and candidate ~ '^[a-z0-9_]{3,24}$'
    and not exists (select 1 from public.profiles p where p.username = candidate and p.id <> (select auth.uid()));
$$;
revoke all on function public.profile_username_available(text) from public;
grant execute on function public.profile_username_available(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars','avatars',true,2097152,array['image/jpeg']) on conflict (id) do nothing;

create policy avatar_upload on storage.objects for insert to authenticated with check (
  bucket_id = 'avatars' and name ~ ('^' || (select auth.uid())::text || '/[0-9a-f-]+\.jpg$')
);
create policy avatar_owner_read on storage.objects for select to authenticated using (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy avatar_delete on storage.objects for delete to authenticated using (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text
);
