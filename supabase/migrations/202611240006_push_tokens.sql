create function public.register_push_token(expo_token text, device_platform text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  insert into public.push_tokens(user_id,token,platform) values (auth.uid(),expo_token,device_platform)
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform;
end;
$$;
revoke all on function public.register_push_token(text,text) from public;
grant execute on function public.register_push_token(text,text) to authenticated;

do $$ begin
  if exists(select 1 from pg_publication where pubname = 'supabase_realtime') and not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
