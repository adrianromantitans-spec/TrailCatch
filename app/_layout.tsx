import '../global.css';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { Component, ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, backend, useSession } from '../services/backend';
import { initialize } from '../db/diary';
import { Notice, usePalette } from '../components/ui';
import { t } from '../i18n';

class DatabaseBoundary extends Component<{ children: ReactNode }, { failed: boolean; attempt: number }> {
  state = { failed: false, attempt: 0 };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed
      ? <Notice message={t.loadError} retry={() => this.setState(({ attempt }) => ({ failed: false, attempt: attempt + 1 }))} />
      : <SQLiteProvider key={this.state.attempt} databaseName="trailcatch.db" onInit={initialize}>
          {this.props.children}
        </SQLiteProvider>;
  }
}

function AppNavigator() {
  const p = usePalette();
  const { session, loading, guest } = useSession();
  if (loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.bg }}>
    <ActivityIndicator accessibilityLabel={t.loading} color={p.accent} />
  </View>;
  const canEnter = !!session || guest || !backend;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: p.bg }, animation: 'fade_from_bottom' }}>
      <Stack.Protected guard={canEnter}>
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="create" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
      </Stack.Protected>
      <Stack.Protected guard={!canEnter}>
        <Stack.Screen name="welcome" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const p = usePalette();
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: p.bg }}>
      <ThemeProvider value={p.dark ? DarkTheme : DefaultTheme}>
        <StatusBar style={p.dark ? 'light' : 'dark'} />
        <AuthProvider>
          <DatabaseBoundary>
            <AppNavigator />
          </DatabaseBoundary>
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
