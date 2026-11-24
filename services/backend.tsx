import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import type { Session } from '@supabase/supabase-js';
import { createURL } from 'expo-linking';
import Storage from 'expo-sqlite/kv-store';
import * as WebBrowser from 'expo-web-browser';
import { createContext, useContext, useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { AppState } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const backend = url && key ? createClient(url, key, {
  auth: { storage: Storage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, flowType: 'pkce' },
}) : null;

const AuthContext = createContext<{
  session: Session | null; loading: boolean; guest: boolean; continueAsGuest: () => void;
}>({ session: null, loading: false, guest: false, continueAsGuest: () => {} });
export const useSession = () => useContext(AuthContext);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(!!backend);
  const [guest, setGuest] = useState(false);
  useEffect(() => {
    if (!backend) return;
    const client = backend;
    const { data } = client.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });
    const refresh = (state: string) => {
      if (state === 'active') client.auth.startAutoRefresh();
      else client.auth.stopAutoRefresh();
    };
    refresh(AppState.currentState ?? 'active');
    const listener = AppState.addEventListener('change', refresh);
    return () => {
      listener.remove();
      data.subscription.unsubscribe();
      client.auth.stopAutoRefresh();
    };
  }, []);
  return <AuthContext.Provider value={{ session, loading, guest, continueAsGuest: () => setGuest(true) }}>{children}</AuthContext.Provider>;
}

export async function signInWithGoogle() {
  if (!backend) return;
  const redirectTo = createURL('account');
  const { data, error } = await backend.auth.signInWithOAuth({
    provider: 'google', options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return;
  const code = new URL(result.url).searchParams.get('code');
  if (!code) throw new Error('OAuth callback omitted code');
  const exchange = await backend.auth.exchangeCodeForSession(code);
  if (exchange.error) throw exchange.error;
}
