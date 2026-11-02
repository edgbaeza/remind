import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { ProfileProvider } from '@/context/profile-context';
import { RemindersProvider } from '@/context/reminders-context';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <ProfileProvider>
        <RemindersProvider>
          <StatusBar style={isDark ? 'light' : 'dark'} />
          <AnimatedSplashOverlay />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="settings" options={{ headerShown: false }} />
            <Stack.Screen name="diagnostics" options={{ headerShown: false }} />
          </Stack>
        </RemindersProvider>
      </ProfileProvider>
    </ThemeProvider>
  );
}
