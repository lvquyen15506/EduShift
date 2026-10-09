import { useEffect } from 'react';
import { router, Stack } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../lib/session';
import { colors } from '../theme';

export default function RootLayout() {
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const shiftId = response.notification.request.content.data?.shift_id;
      if (typeof shiftId === 'string' && shiftId) router.push({ pathname: '/jobs/[id]', params: { id: shiftId } });
    });
    return () => subscription.remove();
  }, []);
  return <SafeAreaProvider><AuthProvider>
    <StatusBar style="dark" />
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="jobs/[id]" options={{ headerShown: true, title: 'Chi tiết ca làm', headerTintColor: colors.magenta, headerShadowVisible: false }} />
    </Stack>
  </AuthProvider></SafeAreaProvider>;
}
