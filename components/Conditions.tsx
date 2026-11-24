import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Point } from '../db/model';
import { locale, t } from '../i18n';
import { getWeather, moonPhase } from '../services/weather';
import { Button, Notice, styles, usePalette } from './ui';

function metric(value: number | null | undefined, unit: string) {
  return typeof value === 'number'
    ? `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)} ${unit}`
    : t.unavailable;
}

export function Conditions({ point, date }: { point: Point; date: string }) {
  const p = usePalette();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Awaited<ReturnType<typeof getWeather>>>();
  const [error, setError] = useState(false);
  const { latitude, longitude } = point;

  useEffect(() => {
    if (!attempt) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
      setError(true);
    }, 12000);
    setResult(undefined);
    setError(false);
    void getWeather({ latitude, longitude }, date, controller.signal)
      .then((data) => { if (!controller.signal.aborted) setResult(data); })
      .catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => clearTimeout(timeout));
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [attempt, date, latitude, longitude]);

  const rows = result ? [
    [t.temperature, metric(result.temperature, t.units.temp)],
    [t.wind, metric(result.wind, t.units.wind)],
    [t.rain, metric(result.rain, t.units.rain)],
    [t.pressure, metric(result.pressure, t.units.pressure)],
    [t.sunrise, result.sunrise ?? t.unavailable],
    [t.sunset, result.sunset ?? t.unavailable],
  ] : [];

  return <View style={{ gap: 8 }}>
    <Text style={[styles.section, { color: p.ink }]}>{t.weather}</Text>
    <Text style={{ color: p.muted }}>{t.estimatedMoon} · {t.moonPhases[moonPhase(date)]}</Text>
    {!attempt ? <Button label={t.weather} icon="partly-sunny-outline" onPress={() => setAttempt(1)} />
      : error ? <Notice message={t.weatherError} retry={() => setAttempt(attempt + 1)} />
      : result === undefined ? <Notice message={t.loading} loading />
      : result === null ? <Notice message={t.unavailable} />
      : rows.map(([label, value]) => <View key={label} style={styles.metricRow}>
        <Text style={[styles.metricLabel, { color: p.muted }]}>{label}</Text><Text style={[styles.metricValue, { color: p.ink }]}>{value}</Text>
      </View>)}
  </View>;
}
