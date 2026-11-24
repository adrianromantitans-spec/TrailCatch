import type { Point } from '../db/model';

export type DiscoveryKind = 'trails' | 'fishing';
export type DiscoveryFeature = {
  id: string;
  name?: string;
  point: Point;
  lines: Point[][];
  isArea: boolean;
  requiresPermit: boolean;
};

type Bounds = [south: number, west: number, north: number, east: number];
type Coordinate = { lat: number; lon: number };
type Geometry = (Coordinate | null)[];
type Element = {
  type: 'node' | 'way' | 'relation'; id: number; tags?: Record<string, string>;
  lat?: number; lon?: number; center?: Coordinate; geometry?: Geometry;
  members?: { type: string; role?: string; geometry?: Geometry }[];
};
type ResponseData = { elements?: Element[]; remark?: string };

const globalEndpoints = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
const cache = new Map<string, { items: DiscoveryFeature[]; expires: number }>();

export function discoveryBounds({ latitude, longitude, latitudeDelta, longitudeDelta }: Point & {
  latitudeDelta: number; longitudeDelta: number;
}): Bounds | undefined {
  if (![latitude, longitude, latitudeDelta, longitudeDelta].every(Number.isFinite) ||
      latitudeDelta <= 0 || longitudeDelta <= 0 || latitudeDelta > 0.18 || longitudeDelta > 0.18) return;
  const south = Math.max(-90, latitude - latitudeDelta / 2);
  const west = Math.max(-180, longitude - longitudeDelta / 2);
  const north = Math.min(90, latitude + latitudeDelta / 2);
  const east = Math.min(180, longitude + longitudeDelta / 2);
  if (south < north && west < east) return [south, west, north, east];
}

const restricted = /^(no|private|customers|destination|delivery|agricultural|forestry)$/;
const walkableHighway = /^(path|footway|track|bridleway)$/;
const explicitFishing = /^(yes|designated|permissive|permit)$/;

function toPoint(coordinate?: Partial<Coordinate> | null): Point | undefined {
  const { lat, lon } = coordinate ?? {};
  if (lat != null && lon != null && Number.isFinite(lat) && Number.isFinite(lon) &&
      Math.abs(lat) <= 90 && Math.abs(lon) <= 180) return { latitude: lat, longitude: lon };
}

function segments(geometry: Geometry) {
  const lines: Point[][] = [];
  let line: Point[] = [];
  for (const coordinate of [...geometry, null]) {
    const point = toPoint(coordinate);
    if (point) {
      line.push(point);
    } else {
      if (line.length > 1) {
        const last = line.length - 1;
        const stride = Math.ceil(line.length / 320);
        lines.push(line.filter((_, index) => index % stride === 0 || index === last));
      }
      line = [];
    }
  }
  return lines;
}

function parseFeature(element: Element, bounds: Bounds, kind: DiscoveryKind): DiscoveryFeature | undefined {
  const tags = element.tags ?? {};
  if (restricted.test(tags.access) || restricted.test(tags.foot) || tags.disused === 'yes' || tags.abandoned === 'yes') return;
  const isArea = kind === 'fishing' && element.type !== 'node';
  let lines: Point[][] = [];
  let point: Point | undefined;
  if (kind === 'fishing') {
    if (restricted.test(tags.fishing) || restricted.test(tags['access:fishing']) ||
        (tags.leisure !== 'fishing' && tags.sport !== 'fishing' && !explicitFishing.test(tags.fishing))) return;
    point = toPoint(isArea ? element.center : element);
  } else {
    const geometry = element.type === 'relation' && ['hiking', 'foot'].includes(tags.route)
      ? (element.members ?? []).flatMap((member) => member.type === 'way' &&
        ['', 'forward', 'backward'].includes(member.role ?? '') && member.geometry ? [member.geometry] : [])
      : element.type === 'way' && tags.name && walkableHighway.test(tags.highway) && element.geometry
        ? [element.geometry] : [];
    lines = geometry.flatMap(segments);
    const [south, west, north, east] = bounds;
    point = lines.flat().find(({ latitude, longitude }) =>
      south <= latitude && latitude <= north && west <= longitude && longitude <= east);
    // A trail may cross the area without any vertex inside it.
    point ??= lines[0]?.[0];
  }
  if (!point) return;
  return { id: `${element.type}/${element.id}`, name: (tags.name || tags.ref)?.trim(), point, lines, isArea,
    requiresPermit: [tags.fishing, tags.access, tags['access:fishing']].includes('permit') };
}

export async function discoverMap(bounds: Bounds, kind: DiscoveryKind, signal: AbortSignal) {
  if (signal.aborted) throw new Error('Discovery cancelled');
  const bbox = bounds.map((coordinate) => coordinate.toFixed(5)).join(',');
  const key = `${kind}:${bbox}`;
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.items;
  const access = '["access"!~"^(no|private|customers|destination|delivery|agricultural|forestry)$"]';
  const selection = kind === 'trails'
    ? `relation["route"~"^(hiking|foot)$"]${access}(${bbox});out body geom 24(${bbox});
       way["highway"~"^(path|footway|track|bridleway)$"]["name"]${access}(${bbox});out body geom 56(${bbox});`
    : `(nwr["leisure"="fishing"]${access}(${bbox});nwr["sport"="fishing"]${access}(${bbox});
       nwr["fishing"~"${explicitFishing.source}"]${access}(${bbox}););out body center 80;`;
  const query = `[out:json][timeout:8];${selection}`;
  const [south, west, north, east] = bounds;
  // The Geofabrik Europe extract covers the app's default region and most of Europe.
  const endpoints = south >= 36 && west >= -12 && north <= 70 && east <= 31
    ? ['https://ovp.dresel.systems/api/interpreter', ...globalEndpoints] : globalEndpoints;
  const params = new URLSearchParams({ data: query });
  for (const endpoint of endpoints) {
    const request = new AbortController();
    const abort = () => request.abort();
    signal.addEventListener('abort', abort);
    const timer = setTimeout(abort, 10000);
    try {
      const response = await fetch(`${endpoint}?${params}`, { signal: request.signal });
      if (!response.ok) continue;
      const data = await response.json() as ResponseData;
      if (!Array.isArray(data.elements) || data.remark) continue;
      const items = data.elements.flatMap((element) => {
        const feature = parseFeature(element, bounds, kind);
        return feature ? [feature] : [];
      });
      if (cache.size >= 20) cache.delete(cache.keys().next().value!);
      cache.set(key, { items, expires: Date.now() + 5 * 60 * 1000 });
      return items;
    } catch { if (signal.aborted) break; }
    finally { clearTimeout(timer); signal.removeEventListener('abort', abort); }
  }
  throw new Error('Overpass unavailable');
}
