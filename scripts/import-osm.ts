import { createClient } from '@supabase/supabase-js';

type Feature = { type: string; id: number; center?: { lat: number; lon: number }; tags?: Record<string,string> };

async function run() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const user = process.env.OSM_IMPORT_USER_ID;
  if (!url || !key || !user) throw new Error('SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OSM_IMPORT_USER_ID');
  const bounds: string = process.env.OSM_IMPORT_BOUNDS ?? '46.60,23.15,46.88,23.76';
  const numbers = bounds.split(',').map(Number);
  const [south,west,north,east] = numbers;
  if (numbers.length !== 4 || !numbers.every(Number.isFinite) || !bounds.split(',').every((value) => value.trim()) ||
    south < -90 || north > 90 || west < -180 || east > 180 || south >= north || west >= east ||
    north - south > 1 || east - west > 1) throw new Error('OSM_IMPORT_BOUNDS');
  const query = `[out:json][timeout:30];(nwr["natural"="water"]["water"~"^(lake|reservoir)$"](${numbers.join(',')});
    nwr["landuse"="reservoir"](${numbers.join(',')});rel["route"="hiking"](${numbers.join(',')}););out center tags;`;
  const response = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST', headers: { 'User-Agent': 'TrailCatch-OSM/1.0 (https://github.com/adrianromantitans-spec/TrailCatch)' },
    body: new URLSearchParams({ data: query }), signal: AbortSignal.timeout(45000),
  });
  if (!response.ok) throw new Error(`Overpass HTTP ${response.status}`);
  const { elements, remark } = await response.json() as { elements: Feature[]; remark?: string };
  if (remark) throw new Error('Overpass returned an incomplete response');
  const unique = new Map(elements.filter((element) => element.center && element.tags?.name)
    .map((element) => [`${element.type}/${element.id}`, element]));
  const rows = Array.from(unique, ([id, element]) => ({
    user_id: user, type: element.tags?.route === 'hiking' ? 'hike' : 'fishing',
    name: element.tags!.name.slice(0, 120), origin: 'OpenStreetMap', origin_id: id,
    visibility: 'public', location: `SRID=4326;POINT(${element.center!.lon} ${element.center!.lat})`,
  }));
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  for (let offset = 0; offset < rows.length; offset += 200) {
    const { error } = await admin.from('spots').upsert(rows.slice(offset, offset + 200), { onConflict: 'origin,origin_id', ignoreDuplicates: true });
    if (error) throw new Error(`Supabase: ${error.code}`);
  }
  console.log(`OSM: ${rows.length}`);
}

void run().catch((error: Error) => { console.error(error.message); process.exitCode = 1; });
