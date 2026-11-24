alter table public.posts add column trip_preview jsonb check (
  trip_preview is null or (trip_id is not null and jsonb_typeof(trip_preview) = 'object'
    and trip_preview - array['title','type','distance'] = '{}'::jsonb
    and jsonb_typeof(trip_preview->'title') = 'string' and char_length(trip_preview->>'title') <= 120
    and trip_preview->>'type' in ('fishing','hike','both')
    and (not trip_preview ? 'distance' or jsonb_typeof(trip_preview->'distance') = 'number'))
);
grant insert (trip_preview) on public.posts to authenticated;

create function public.publish_post(
  message text, audience text, approximate boolean, attached_spot uuid, attached_trip text,
  latitude double precision, longitude double precision, photos jsonb, trip_summary jsonb default null
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare post uuid;
declare location extensions.geography;
begin
  if jsonb_typeof(photos) <> 'array' or jsonb_array_length(photos) not between 0 and 10 then
    raise exception 'invalid photos' using errcode = '23514';
  end if;
  if nullif(btrim(message),'') is null and coalesce(jsonb_array_length(photos),0) = 0 then
    raise exception 'empty post' using errcode = '23514';
  end if;
  if latitude between -90 and 90 and longitude between -180 and 180 then
    location := extensions.st_setsrid(extensions.st_makepoint(longitude,latitude),4326)::extensions.geography;
  end if;
  insert into public.posts (caption,visibility,approximate_location,spot_id,trip_id,location,trip_preview)
  values (message,audience,approximate,attached_spot,attached_trip,location,trip_summary)
  returning id into post;
  insert into public.post_photos(post_id,url,thumbnail_url,position)
  select post,entry->>'url',entry->>'thumbnail_url',(ordinality - 1)::smallint
  from jsonb_array_elements(photos) with ordinality as image(entry,ordinality);
  return post;
end;
$$;
revoke all on function public.publish_post(text,text,boolean,uuid,text,double precision,double precision,jsonb,jsonb) from public;
grant execute on function public.publish_post(text,text,boolean,uuid,text,double precision,double precision,jsonb,jsonb) to authenticated;
