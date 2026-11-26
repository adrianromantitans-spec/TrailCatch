import type { Point } from '../db/model';

export type DiscoveryKind = 'trails' | 'fishing';
export type DiscoveryFeature = {
  id: string;
  name?: string;
  point: Point;
  lines: Point[][];
  isArea: boolean;
  requiresPermit: boolean;
  guide?: { country: string; reference: string; authority: string; url: string };
};

export type Bounds = [south: number, west: number, north: number, east: number];
export type TrailCursor = { route: number | null; way: number | null };
type DiscoveryPage = { items: DiscoveryFeature[]; next?: TrailCursor };
type DiscoveryRegion = Point & { latitudeDelta: number; longitudeDelta: number };
type Coordinate = { lat: number; lon: number };
type Geometry = (Coordinate | null)[];
type Element = {
  type: 'node' | 'way' | 'relation'; id: number; tags?: Record<string, string>;
  lat?: number; lon?: number; center?: Coordinate; geometry?: Geometry;
  members?: { type: string; role?: string; geometry?: Geometry }[];
};
type ResponseData = { elements?: Element[]; remark?: string };

const globalEndpoints = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
const cache = new Map<string, { page: DiscoveryPage; expires: number }>();
const maxSearchDelta = 0.18;

export function focusDiscoveryRegion(region: DiscoveryRegion): DiscoveryRegion {
  const span = Math.max(region.latitudeDelta, region.longitudeDelta);
  if (!Number.isFinite(span) || span <= maxSearchDelta) return region;

  // Leave room for the native map to adjust the camera to its aspect ratio.
  const scale = (maxSearchDelta * 0.8) / span;
  return { ...region, latitudeDelta: region.latitudeDelta * scale, longitudeDelta: region.longitudeDelta * scale };
}

export function discoveryBounds({ latitude, longitude, latitudeDelta, longitudeDelta }: DiscoveryRegion): Bounds | undefined {
  if (![latitude, longitude, latitudeDelta, longitudeDelta].every(Number.isFinite) ||
      latitudeDelta <= 0 || longitudeDelta <= 0 || latitudeDelta > maxSearchDelta || longitudeDelta > maxSearchDelta) return;
  const south = Math.max(-90, latitude - latitudeDelta / 2);
  const west = Math.max(-180, longitude - longitudeDelta / 2);
  const north = Math.min(90, latitude + latitudeDelta / 2);
  const east = Math.min(180, longitude + longitudeDelta / 2);
  if (south < north && west < east) return [south, west, north, east];
}

export function trailNearPoint(point: Point, trails: DiscoveryFeature[], longitudeTolerance: number) {
  const longitudeScale = Math.cos(point.latitude * Math.PI / 180);
  let nearest: DiscoveryFeature | undefined;
  let best = (longitudeTolerance * longitudeScale) ** 2;
  for (const trail of trails) for (const line of trail.lines) for (let index = 1; index < line.length; index++) {
    const start = line[index - 1];
    const end = line[index];
    const x = (start.longitude - point.longitude) * longitudeScale;
    const y = start.latitude - point.latitude;
    const dx = (end.longitude - start.longitude) * longitudeScale;
    const dy = end.latitude - start.latitude;
    const length = dx * dx + dy * dy;
    const progress = length ? Math.min(1, Math.max(0, -(x * dx + y * dy) / length)) : 0;
    const distance = (x + progress * dx) ** 2 + (y + progress * dy) ** 2;
    if (distance < best) {
      best = distance;
      nearest = { ...trail, point: { latitude: start.latitude + progress * (end.latitude - start.latitude),
        longitude: start.longitude + progress * (end.longitude - start.longitude) } };
    }
  }
  return nearest;
}

const restricted = /^(no|private|customers|destination|delivery|agricultural|forestry)$/;
const walkableHighway = /^(path|footway|track|bridleway|pedestrian|steps)$/;
const designatedFoot = /^(yes|designated|permissive|official)$/;
const routeLimit = 16;
const wayLimit = 160;
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
      : element.type === 'way' && element.geometry && (walkableHighway.test(tags.highway) ||
        (tags.highway === 'cycleway' && designatedFoot.test(tags.foot))) && !['sidewalk', 'crossing'].includes(tags.footway)
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

export async function discoverMap(bounds: Bounds, kind: DiscoveryKind, signal: AbortSignal,
  cursor: TrailCursor = { route: 0, way: 0 }): Promise<DiscoveryPage> {
  if (signal.aborted) throw new Error('Discovery cancelled');
  const bbox = bounds.map((coordinate) => coordinate.toFixed(5)).join(',');
  const key = `${kind}:${bbox}:${cursor.route}:${cursor.way}`;
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.page;
  const access = `["access"!~"${restricted.source}"]["foot"!~"${restricted.source}"]`;
  const byId = (after: number) => `(if:id()>${after})`;
  const selection = kind === 'trails'
    ? [cursor.route === null ? '' : `relation["route"~"^(hiking|foot)$"]${access}(${bbox})${byId(cursor.route)};
        out body geom ${routeLimit + 1}(${bbox});`,
      cursor.way === null ? '' : `(way["highway"~"${walkableHighway.source}"]["footway"!~"^(sidewalk|crossing)$"]${access}(${bbox})${byId(cursor.way)};
        way["highway"="cycleway"]["foot"~"${designatedFoot.source}"]${access}(${bbox})${byId(cursor.way)};);
        out body geom ${wayLimit + 1}(${bbox});`].join(' ')
    : `(nwr["leisure"="fishing"]${access}(${bbox});nwr["sport"="fishing"]${access}(${bbox});
       nwr["fishing"~"${explicitFishing.source}"]${access}(${bbox}););out body center 80;`;
  const query = `[out:json][timeout:8];${selection}`;
  const [south, west, north, east] = bounds;
  // The Geofabrik Europe extract covers the app's default region and most of Europe.
  const endpoints = south >= 35 && west >= -25 && north <= 72 && east <= 45
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
      const routes = data.elements.filter(({ type }) => type === 'relation');
      const ways = data.elements.filter(({ type }) => type === 'way');
      const elements = kind === 'trails' ? [...routes.slice(0, routeLimit), ...ways.slice(0, wayLimit)] : data.elements;
      const page: DiscoveryPage = { items: elements.flatMap((element) => {
        const feature = parseFeature(element, bounds, kind);
        return feature ? [feature] : [];
      }) };
      if (kind === 'trails' && (routes.length > routeLimit || ways.length > wayLimit)) {
        page.next = { route: routes.length > routeLimit ? routes[routeLimit - 1].id : null,
          way: ways.length > wayLimit ? ways[wayLimit - 1].id : null };
      }
      if (cache.size >= 20) cache.delete(cache.keys().next().value!);
      cache.set(key, { page, expires: Date.now() + 5 * 60 * 1000 });
      return page;
    } catch { if (signal.aborted) break; }
    finally { clearTimeout(timer); signal.removeEventListener('abort', abort); }
  }
  throw new Error('Overpass unavailable');
}
