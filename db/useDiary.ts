import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { allOutings, pageOutings } from './diary';
import { Outing } from './model';

export function useDiary() {
  const db = useSQLiteContext();
  const [items, setItems] = useState<Outing[]>();
  const [error, setError] = useState(false);
  const load = useCallback(async () => {
    try {
      setItems(await allOutings(db));
      setError(false);
    } catch {
      setError(true);
    }
  }, [db]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  return { items, error, load };
}

export function useOutingPages(filter: Parameters<typeof pageOutings>[2] = {}) {
  const db = useSQLiteContext();
  const { query, type, saved } = filter;
  const filterKey = JSON.stringify([query, type, saved]);
  const [result, setResult] = useState<{ key: string; items?: Outing[]; error: boolean }>();
  const [refreshing, setRefreshing] = useState(false);
  const state = useRef({ version: 0, next: 0, more: true, busy: false });

  const load = useCallback(async (reset: boolean) => {
    const current = state.current;
    if (!reset && (current.busy || !current.more || current.next === 0)) return;
    const version = reset ? ++current.version : current.version;
    const page = reset ? 0 : current.next;
    current.busy = true;
    if (reset) setRefreshing(true);
    try {
      const result = await pageOutings(db, page, { query, type, saved });
      if (current.version !== version) return;
      current.next = page + 1;
      current.more = result.more;
      setResult((old) => ({
        key: filterKey, error: false,
        items: reset ? result.items : [...(old?.key === filterKey ? old.items ?? [] : []), ...result.items],
      }));
    } catch {
      if (current.version === version) {
        setResult((old) => ({
          key: filterKey, error: true, items: old?.key === filterKey ? old.items : undefined,
        }));
      }
    } finally {
      if (current.version === version) {
        current.busy = false;
        setRefreshing(false);
      }
    }
  }, [db, filterKey, query, type, saved]);
  useFocusEffect(useCallback(() => { void load(true); }, [load]));
  useEffect(() => () => { state.current.version++; }, []);
  const change = useCallback((outing: Outing) => {
    setResult((old) => old && { ...old, items: old.items?.map((item) => item.id === outing.id ? outing : item) });
  }, []);
  const visible = result?.key === filterKey ? result : undefined;
  return { items: visible?.items, error: visible?.error ?? false, refreshing, load, change };
}
