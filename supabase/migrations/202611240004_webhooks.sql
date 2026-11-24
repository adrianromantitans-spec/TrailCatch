-- The fixtures can run without Supabase's network extensions. Hosted Supabase enables pg_net.
do $$ begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net with schema extensions;
  end if;
end $$;

create function private.send_webhook() returns trigger
language plpgsql security definer set search_path = '' as $$
declare endpoint text;
declare shared_secret text;
begin
  if to_regclass('vault.decrypted_secrets') is null or to_regnamespace('net') is null then return new; end if;
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1'
    into endpoint using tg_argv[0];
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1'
    into shared_secret using 'trailcatch_webhook_secret';
  if endpoint is not null and shared_secret is not null then
    execute 'select net.http_post(url := $1, body := $2, headers := $3)'
      using endpoint, jsonb_build_object('id',new.id),
        jsonb_build_object('content-type','application/json','x-trailcatch-webhook',shared_secret);
  end if;
  return new;
end;
$$;
create trigger report_email after insert on public.reports
for each row execute function private.send_webhook('trailcatch_report_webhook_url');
create trigger notification_push after insert on public.notifications
for each row execute function private.send_webhook('trailcatch_push_webhook_url');
