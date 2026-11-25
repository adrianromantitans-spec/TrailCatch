import '../global.css';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { Component, ReactNode } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from '../services/backend';
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

export default function RootLayout() {
  const p = usePalette();
  const theme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, primary: p.accent, background: p.bg,
    card: p.surface, text: p.ink, border: p.line, notification: p.danger } };
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: p.bg }}>
      <ThemeProvider value={theme}>
        <StatusBar style="dark" />
        <AuthProvider>
          <DatabaseBoundary>
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: p.bg }, animation: 'fade_from_bottom' }}>
              <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
              <Stack.Screen name="welcome" options={{ animation: 'fade', gestureEnabled: false }} />
              <Stack.Screen name="create" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
              <Stack.Screen name="post/comments" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.56, 1],
                sheetCornerRadius: 28, sheetGrabberVisible: true, sheetExpandsWhenScrolledToEdge: true }} />
            </Stack>
          </DatabaseBoundary>
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
