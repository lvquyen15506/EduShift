import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { LoadingView, Notice } from '../../components/Ui';
import { api, errorMessage } from '../../lib/api';
import { useSession } from '../../lib/session';
import type { Shift, StudentDashboard } from '../../lib/types';
import { colors } from '../../theme';

function ShiftCard({ shift }: { shift: Shift }) {
  const start = new Date(shift.start_time);
  return <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/jobs/[id]', params: { id: shift.id } })} style={styles.card}>
    <View style={styles.cardTop}><Text style={styles.company}>{shift.company_name}</Text><View style={styles.score}><Text style={styles.scoreText}>{shift.match_score ?? 0}% phù hợp</Text></View></View>
    <Text style={styles.jobTitle}>{shift.title}</Text>
    <Text style={styles.meta}>⌖ {shift.location}</Text>
    <Text style={styles.meta}>◷ {start.toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' })}</Text>
    <View style={styles.cardBottom}><Text style={styles.rate}>{Number(shift.hourly_rate || 0).toLocaleString('vi-VN')} đ/giờ</Text><Text style={styles.details}>Xem chi tiết →</Text></View>
  </Pressable>;
}

export default function Jobs() {
  const { session } = useSession();
  const [data, setData] = useState<StudentDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async (refresh = false) => {
    if (!session) return;
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const next = await api<StudentDashboard>('/api/student/dashboard', { token: session.access_token });
      setData(next); setError('');
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setLoading(false); setRefreshing(false); }
  }, [session]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (loading && !data) return <LoadingView />;
  if (error && !data) return <Notice title="Không tải được việc làm" detail={error} onRetry={() => { void load(); }} />;
  return <FlatList
    style={styles.screen}
    data={data?.recommended_shifts || []}
    keyExtractor={item => item.id}
    renderItem={({ item }) => <ShiftCard shift={item} />}
    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void load(true); }} tintColor={colors.magenta} />}
    contentContainerStyle={styles.content}
    ListHeaderComponent={<View><Text style={styles.eyebrow}>EDUMATCH CHO SINH VIÊN</Text><Text style={styles.heading}>Việc làm hợp lịch</Text><Text style={styles.subtitle}>Các ca không trùng lịch học, xếp theo Match Score của bạn.</Text><View style={styles.stats}><View><Text style={styles.statValue}>{data?.stats.available_shifts ?? 0}</Text><Text style={styles.statLabel}>Ca phù hợp</Text></View><View><Text style={styles.statValue}>{data?.stats.pending_applications ?? 0}</Text><Text style={styles.statLabel}>Đang chờ</Text></View><View><Text style={styles.statValue}>{data?.stats.accepted_applications ?? 0}</Text><Text style={styles.statLabel}>Đã nhận</Text></View></View>{error ? <Text style={styles.error}>{error}</Text> : null}<Text style={styles.section}>Gợi ý cho bạn</Text></View>}
    ListEmptyComponent={<Notice title="Chưa có ca phù hợp" detail="Hãy cập nhật lịch học hoặc kéo xuống để tải lại khi có ca mới." />}
  />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 18, paddingBottom: 40 },
  eyebrow: { color: colors.magenta, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  heading: { marginTop: 6, color: colors.ink, fontSize: 29, fontWeight: '800' },
  subtitle: { marginTop: 6, color: colors.muted, fontSize: 14, lineHeight: 21 },
  stats: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 22, paddingVertical: 17, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: '#fff' },
  statValue: { color: colors.magenta, fontSize: 23, fontWeight: '800', textAlign: 'center' },
  statLabel: { color: colors.muted, fontSize: 11, textAlign: 'center' },
  error: { marginTop: 12, color: colors.red, fontSize: 13 },
  section: { marginTop: 26, marginBottom: 12, color: colors.ink, fontSize: 18, fontWeight: '800' },
  card: { marginBottom: 12, padding: 17, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: '#fff', gap: 7 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  company: { flex: 1, color: colors.magenta, fontSize: 12, fontWeight: '800' },
  score: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 20, backgroundColor: colors.mint },
  scoreText: { color: colors.green, fontSize: 11, fontWeight: '800' },
  jobTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  meta: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 7, paddingTop: 11, borderTopWidth: 1, borderTopColor: colors.line },
  rate: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  details: { color: colors.magenta, fontSize: 12, fontWeight: '700' },
});
