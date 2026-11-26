export type OutingType = 'fishing' | 'hike' | 'both';
export type Point = { latitude: number; longitude: number };
export type Photo = { uri: string } | { sample: 'lake' | 'trail' };
export const catchWeatherOptions = ['sunny', 'cloudy', 'rain', 'wind'] as const;
export type CatchWeather = typeof catchWeatherOptions[number];
export type Catch = {
  species: string;
  size?: number;
  weight?: number;
  bait: string;
  time: string;
  photo?: Photo;
  weather?: CatchWeather;
  released?: boolean;
};
export type CatchSummary = Pick<Catch, 'species' | 'size'>;
export type RouteData = { distance?: number; duration?: number; ascent?: number };
export type Comment = { id: string; text: string };
export type Outing = {
  id: string;
  type: OutingType;
  title: string;
  date: string;
  notes: string;
  point: Point;
  photos: Photo[];
  catches: Catch[];
  route?: RouteData;
  sample?: boolean;
  likes: number;
  liked: boolean;
  saved: boolean;
  comments: Comment[];
};

export const PAGE_SIZE = 20;
export const outingTypes: OutingType[] = ['fishing', 'hike', 'both'];
export const photoList = (outing: Outing) => [
  ...outing.photos,
  ...outing.catches.flatMap(({ photo }) => photo ? [photo] : []),
];

export function localDate(date = new Date()) {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((part) => String(part).padStart(2, '0')).join('-');
}
