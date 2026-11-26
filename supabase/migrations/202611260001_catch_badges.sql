begin;

create or replace function private.valid_catch_badges(badges jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(badges) = 'array' then not exists (
    select 1 from jsonb_array_elements(badges) as element(badge)
    where (case when jsonb_typeof(badge) = 'object' then
      badge - array['species','size'] = '{}'::jsonb
      and jsonb_typeof(badge->'species') = 'string'
      and char_length(badge->>'species') <= 80
      and (not badge ? 'size' or case when jsonb_typeof(badge->'size') = 'number'
        then (badge->>'size')::numeric >= 0 else false end)
    else false end) is not true
  ) else false end;
$$;

do $$
declare old_check name;
begin
  select conname into old_check from pg_catalog.pg_constraint
  where conrelid = 'public.posts'::regclass and contype = 'c'
    and pg_catalog.pg_get_constraintdef(oid) like '%jsonb_typeof(trip_preview)%'
    and pg_catalog.pg_get_constraintdef(oid) not like '%valid_catch_badges%';
  if old_check is not null then
    execute pg_catalog.format('alter table public.posts drop constraint %I', old_check);
  end if;
end;
$$;

alter table public.posts drop constraint if exists posts_trip_preview_with_catches_check;
alter table public.posts add constraint posts_trip_preview_with_catches_check check (
  trip_preview is null or (trip_id is not null and jsonb_typeof(trip_preview) = 'object'
    and trip_preview - array['title','type','distance','catches'] = '{}'::jsonb
    and jsonb_typeof(trip_preview->'title') = 'string' and char_length(trip_preview->>'title') <= 120
    and trip_preview->>'type' in ('fishing','hike','both')
    and (not trip_preview ? 'distance' or jsonb_typeof(trip_preview->'distance') = 'number')
    and (not trip_preview ? 'catches' or private.valid_catch_badges(trip_preview->'catches')))
);

commit;
