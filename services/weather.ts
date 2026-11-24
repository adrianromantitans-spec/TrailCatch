import { localDate, Point } from '../db/model';

type WeatherResponse = {
  hourly?: { time: string[]; temperature_2m: number[]; wind_speed_10m: number[]; rain: number[]; surface_pressure: number[] };
  daily?: { sunrise: (string | null)[]; sunset: (string | null)[] };
};

export async function getWeather(point: Point, date: string, signal?: AbortSignal) {
  const recent = new Date();
  recent.setDate(recent.getDate() - 5);
  const lastForecast = new Date();
  lastForecast.setDate(lastForecast.getDate() + 15);
  if (date > localDate(lastForecast) || date < '1940-01-01') return null;
  const base = date < localDate(recent)
    ? 'https://archive-api.open-meteo.com/v1/archive'
    : 'https://api.open-meteo.com/v1/forecast';
  const params = new URLSearchParams({
    latitude: String(point.latitude), longitude: String(point.longitude),
    start_date: date, end_date: date, timezone: 'auto',
    hourly: 'temperature_2m,wind_speed_10m,rain,surface_pressure', daily: 'sunrise,sunset',
  });
  const response = await fetch(`${base}?${params}`, { signal });
  if (!response.ok) throw new Error(String(response.status));
  const { hourly, daily } = await response.json() as WeatherResponse;
  const noon = hourly?.time.indexOf(`${date}T12:00`) ?? -1;
  return {
    temperature: hourly?.temperature_2m[noon],
    wind: hourly?.wind_speed_10m[noon],
    rain: hourly?.rain.every((value) => typeof value === 'number')
      ? hourly.rain.reduce((total, value) => total + value, 0) : undefined,
    pressure: hourly?.surface_pressure[noon],
    sunrise: daily?.sunrise[0]?.split('T')[1],
    sunset: daily?.sunset[0]?.split('T')[1],
  };
}

export function moonPhase(date: string) {
  const reference = Date.UTC(2000, 0, 6, 18, 14);
  const cycle = 29.530588853;
  const age = (Date.parse(`${date}T12:00:00Z`) - reference) / 86400000;
  return ((Math.round(age / cycle * 8) % 8) + 8) % 8;
}
