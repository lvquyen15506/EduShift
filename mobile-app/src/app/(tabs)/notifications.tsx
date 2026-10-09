import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { LoadingView, Notice } from '../../components/Ui';
import { api, errorMessage } from '../../lib/api';
import { useSession } from '../../lib/session';
import type { NotificationItem } from '../../lib/types';
import { colors } from '../../theme';

export default function Notifications() {
  const { session } = useSession();
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async (refresh = false) => {
    if (!session) return;
    if (refresh) setRefreshing(true); else setLoading(true);
    try { setItems(await api<NotificationItem[]>('/api/notifications', { token: session.access_token })); setError(''); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setLoading(false); setRefreshing(false); }
  }, [session]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function markAllRead() {
    if (!session || busy) return;
    setBusy(true);
    try {
      await api('/api/notifications/read-all', { method: 'PATCH', token: session.access_token });
      setItems(current => current?.map(item => ({ ...item, is_read: true })) || []);
      setError('');
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }

  if (loading && !items) return <LoadingView />;
  if (error && !items) return <Notice title="Không tải được thông báo" detail={error} onRetry={() => { void load(); }} />;
  return <FlatList
    style={styles.screen}
    contentContainerStyle={styles.content}
    data={items || []}
    keyExtractor={item => item.id}
    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void load(true); }} tintColor={colors.magenta} />}
    ListHeaderComponent={<View><Text style={styles.eyebrow}>CẬP NHẬT MỚI</Text><Text style={styles.heading}>Thông báo</Text><Text style={styles.subtitle}>Ca phù hợp và trạng thái ứng tuyển của bạn.</Text><View style={styles.headerRow}><Text style={styles.count}>{items?.filter(item => !item.is_read).length || 0} chưa đọc</Text><Pressable accessibilityRole="button" disabled={busy || !items?.some(item => !item.is_read)} onPress={() => { void markAllRead(); }}><Text style={styles.mark}>Đánh dấu đã đọc</Text></Pressable></View>{error ? <Text style={styles.error}>{error}</Text> : null}</View>}
    ListEmptyComponent={<Notice title="Chưa có thông báo" detail="Khi có ca phù hợp hoặc cập nhật đơn ứng tuyển, bạn sẽ thấy ở đây." />}
    renderItem={({ item }) => <Pressable accessibilityRole={item.shift_id ? 'button' : undefined} accessibilityLabel={item.shift_id ? `${item.title}. Xem chi tiết ca làm` : undefined} onPress={item.shift_id ? () => router.push({ pathname: '/jobs/[id]', params: { id: item.shift_id! } }) : undefined} style={[styles.card, !item.is_read && styles.unread]}><Text style={styles.title}>{item.title}</Text><Text style={styles.body}>{item.body}</Text><Text style={styles.time}>{new Date(item.created_at).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}</Text>{item.shift_id ? <Text style={styles.link}>Xem ca làm →</Text> : null}</Pressable>}
  />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 18, paddingBottom: 40 },
  eyebrow: { color: colors.magenta, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  heading: { marginTop: 6, color: colors.ink, fontSize: 29, fontWeight: '800' },
  subtitle: { marginTop: 6, color: colors.muted, fontSize: 14, lineHeight: 21 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 13 },
  count: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  mark: { color: colors.magenta, fontSize: 12, fontWeight: '700' },
  card: { marginBottom: 10, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: '#fff', gap: 6 },
  unread: { borderLeftWidth: 4, borderLeftColor: colors.magenta, backgroundColor: '#fffafd' },
  title: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  body: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  time: { color: colors.muted, fontSize: 11 },
  link: { color: colors.magenta, fontSize: 12, fontWeight: '700', marginTop: 4 },
  error: { color: colors.red, fontSize: 12, marginBottom: 12 },
});
