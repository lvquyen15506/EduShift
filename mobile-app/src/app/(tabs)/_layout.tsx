import { Redirect, Tabs, router } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LoadingView } from '../../components/Ui';
import { useSession } from '../../lib/session';
import { colors } from '../../theme';

export default function TabsLayout() {
  const { session, loading } = useSession();
  if (loading) return <LoadingView />;
  if (!session) return <Redirect href="/login" />;
  return <Tabs screenOptions={{
    headerStyle: { backgroundColor: '#fff' },
    headerTitleStyle: { color: colors.ink, fontWeight: '700' },
    headerShadowVisible: false,
    headerRight: () => <Pressable accessibilityRole="button" accessibilityLabel="Mở thông báo" onPress={() => router.push('/(tabs)/notifications')} style={{ paddingHorizontal: 17, paddingVertical: 8 }}><Ionicons name="notifications-outline" size={23} color={colors.magenta} /></Pressable>,
    tabBarActiveTintColor: colors.magenta,
    tabBarInactiveTintColor: colors.muted,
    tabBarStyle: { backgroundColor: '#fff', borderTopColor: colors.line, height: 64, paddingBottom: 8 },
    tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
  }}>
    <Tabs.Screen name="jobs" options={{ title: 'Việc phù hợp', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>✦</Text> }} />
    <Tabs.Screen name="schedule" options={{ title: 'Lịch của tôi', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>▦</Text> }} />
    <Tabs.Screen name="assistant" options={{ title: 'Trợ lý', tabBarIcon: ({ color, size }) => <Ionicons name="chatbubble-ellipses-outline" size={size} color={color} /> }} />
    <Tabs.Screen name="notifications" options={{ href: null, title: 'Thông báo' }} />
    <Tabs.Screen name="profile" options={{ title: 'Hồ sơ', tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} /> }} />
  </Tabs>;
}
