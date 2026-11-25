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

const sessionKey = url ? `sb-${new URL(url).hostname.split('.')[0]}-auth-token` : '';
let rememberSession = true;
let sessionInMemory: string | null = null;

const authStorage = {
  getItem: (name: string) => name === sessionKey && !rememberSession ? sessionInMemory : Storage.getItem(name),
  async setItem(name: string, value: string) {
    if (name === sessionKey && !rememberSession) {
      sessionInMemory = value;
      await Storage.removeItem(name);
    } else await Storage.setItem(name, value);
  },
  async removeItem(name: string) {
    if (name === sessionKey) sessionInMemory = null;
    await Storage.removeItem(name);
  },
};

export function setSessionPersistence(remember: boolean) {
  rememberSession = remember;
}

export const backend = url && key ? createClient(url, key, {
  auth: { storage: authStorage, storageKey: sessionKey, persistSession: true, autoRefreshToken: true,
    detectSessionInUrl: false, flowType: 'pkce' },
}) : null;

const AuthContext = createContext<{
  session: Session | null; loading: boolean; guest: boolean; continueAsGuest: () => void; resetGuest: () => void;
  profileSetup: 'checking' | 'required' | 'complete'; finishProfileSetup: (userId: string) => void;
}>({ session: null, loading: false, guest: false, continueAsGuest: () => {}, resetGuest: () => {},
  profileSetup: 'complete', finishProfileSetup: () => {} });
export const useSession = () => useContext(AuthContext);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(!!backend);
  const [guest, setGuest] = useState(false);
  const [profile, setProfile] = useState<{ userId: string; complete: boolean }>();
  const userId = session?.user.id;
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
  useEffect(() => {
    if (!backend || !userId) return;
    const request = new AbortController();
    const update = (complete: boolean) => {
      if (!request.signal.aborted) setProfile((value) => value?.userId === userId && value.complete ? value : { userId, complete });
    };
    void backend.from('profiles').select('onboarding_complete').eq('id', userId).abortSignal(request.signal).maybeSingle()
      .then(({ data, error }) => update(error ? true : data?.onboarding_complete !== false), () => update(true));
    return () => request.abort();
  }, [userId]);
  const profileSetup = !userId ? 'complete' : profile?.userId !== userId ? 'checking' : profile.complete ? 'complete' : 'required';
  return <AuthContext.Provider value={{ session, loading, guest, profileSetup,
    finishProfileSetup: (id) => setProfile({ userId: id, complete: true }),
    continueAsGuest: () => setGuest(true), resetGuest: () => setGuest(false) }}>{children}</AuthContext.Provider>;
}

export class ProviderUnavailable extends Error {}

export async function signInWithProvider(provider: 'google' | 'apple') {
  if (!backend || !url || !key) return;
  const settings = await fetch(new URL('auth/v1/settings', url.endsWith('/') ? url : `${url}/`).href, {
    headers: { apikey: key },
  });
  if (settings.ok) {
    const { external } = await settings.json() as { external?: Partial<Record<'google' | 'apple', boolean>> };
    if (external?.[provider] === false) throw new ProviderUnavailable();
  }
  const redirectTo = createURL('account');
  const { data, error } = await backend.auth.signInWithOAuth({
    provider, options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return;
  const code = new URL(result.url).searchParams.get('code');
  if (!code) throw new Error('OAuth callback omitted code');
  const exchange = await backend.auth.exchangeCodeForSession(code);
  if (exchange.error) throw exchange.error;
}

export async function requestPasswordReset(email: string) {
  if (!backend) return;
  const { error } = await backend.auth.resetPasswordForEmail(email, { redirectTo: createURL('reset-password') });
  if (error) throw error;
}
