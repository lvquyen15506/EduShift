import { Redirect, Tabs } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { LoadingView } from '../../components/Ui';
import { useSession } from '../../lib/session';
import { colors } from '../../theme';

export default function TabsLayout() {
  const { session, loading, signOut } = useSession();
  if (loading) return <LoadingView />;
  if (!session) return <Redirect href="/login" />;
  return <Tabs screenOptions={{
    headerStyle: { backgroundColor: '#fff' },
    headerTitleStyle: { color: colors.ink, fontWeight: '700' },
    headerShadowVisible: false,
    headerRight: () => <Pressable accessibilityRole="button" onPress={() => { void signOut(); }} style={{ paddingHorizontal: 16, paddingVertical: 8 }}><Text style={{ color: colors.magenta, fontWeight: '700' }}>Thoát</Text></Pressable>,
    tabBarActiveTintColor: colors.magenta,
    tabBarInactiveTintColor: colors.muted,
    tabBarStyle: { backgroundColor: '#fff', borderTopColor: colors.line, height: 64, paddingBottom: 8 },
    tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
  }}>
    <Tabs.Screen name="jobs" options={{ title: 'Việc phù hợp', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>✦</Text> }} />
    <Tabs.Screen name="schedule" options={{ title: 'Lịch của tôi', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>▦</Text> }} />
    <Tabs.Screen name="notifications" options={{ title: 'Thông báo', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>●</Text> }} />
  </Tabs>;
}
