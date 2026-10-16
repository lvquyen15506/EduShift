import { useCallback, useState } from 'react';
import { Redirect, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ActionButton, LoadingView, Notice } from '../../components/Ui';
import { api, errorMessage } from '../../lib/api';
import { useSession } from '../../lib/session';
import type { EmployerProfile } from '../../lib/types';
import { colors } from '../../theme';

export default function EmployerProfileScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const { session, loading: sessionLoading } = useSession();
  const [profile, setProfile] = useState<EmployerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!session || !id) return;
    setLoading(true);
    try {
      setProfile(await api<EmployerProfile>('/api/employers/' + encodeURIComponent(id) + '/profile', { token: session.access_token }));
      setError('');
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setLoading(false); }
  }, [id, session]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function toggleFollow() {
    if (!session || !id || !profile || busy) return;
    setBusy(true); setError('');
    try {
      const next = await api<{ following: boolean }>('/api/employers/' + encodeURIComponent(id) + '/follow', {
        method: profile.following ? 'DELETE' : 'PUT', token: session.access_token,
      });
      setProfile(current => current ? { ...current, following: next.following } : current);
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }

  if (sessionLoading) return <LoadingView />;
  if (!session) return <Redirect href="/login" />;
  if (loading && !profile) return <LoadingView />;
  if (!profile) return <Notice title="Không tải được hồ sơ doanh nghiệp" detail={error} onRetry={() => { void load(); }} />;

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <View style={styles.hero}>
      <Text style={styles.eyebrow}>DOANH NGHIỆP EDUSHIFT</Text>
      <Text style={styles.title}>{profile.name}</Text>
      <Text style={styles.muted}>{profile.verified ? '✓ Đã xác minh' : 'Chưa xác minh'}{profile.address ? ' · ' + profile.address : ''}</Text>
      <Text style={styles.rating}>★ {profile.rating == null ? 'Chưa có đánh giá' : `${Number(profile.rating).toFixed(1)}/5 · ${profile.reviews.length} đánh giá`}</Text>
      <ActionButton title={profile.following ? 'Đang theo dõi · Bỏ theo dõi' : 'Theo dõi doanh nghiệp'} secondary={profile.following} onPress={() => { void toggleFollow(); }} busy={busy} />
      <Text style={styles.muted}>Theo dõi để nhận thông báo khi doanh nghiệp đăng ca mới, kể cả khi ca hiện tại trùng lịch.</Text>
    </View>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <View style={styles.card}><Text style={styles.section}>Các ca đã đăng</Text>
      {profile.history.length ? profile.history.map(item => <Pressable key={item.id} accessibilityRole={item.status === 'OPEN' ? 'button' : undefined} disabled={item.status !== 'OPEN'} onPress={() => router.push({ pathname: '/jobs/[id]', params: { id: item.id } })} style={styles.row}>
        <Text style={styles.rowTitle}>{item.title}</Text><Text style={styles.muted}>{item.location} · {new Date(item.start_time).toLocaleString('vi-VN')}</Text><Text style={styles.link}>{item.status === 'OPEN' ? 'Đang tuyển · Xem ca →' : item.status === 'FULL' ? 'Đã đủ người' : 'Đã đóng'}</Text>
      </Pressable>) : <Text style={styles.muted}>Chưa có ca làm.</Text>}
    </View>
    <View style={styles.card}><Text style={styles.section}>Đánh giá từ sinh viên</Text>
      {profile.reviews.length ? profile.reviews.map((item, index) => <View style={styles.row} key={`${item.created_at}-${index}`}><Text style={styles.rating}>★ {item.rating}/5</Text><Text style={styles.muted}>{item.comment || 'Không có nhận xét.'}</Text><Text style={styles.date}>{new Date(item.created_at).toLocaleDateString('vi-VN')}</Text></View>) : <Text style={styles.muted}>Chưa có đánh giá.</Text>}
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas }, content: { padding: 18, gap: 14, paddingBottom: 40 },
  hero: { padding: 22, borderRadius: 18, backgroundColor: colors.blush, gap: 10 },
  eyebrow: { color: colors.magenta, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  title: { color: colors.ink, fontSize: 26, fontWeight: '800' }, rating: { color: colors.magenta, fontSize: 14, fontWeight: '800' },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 20 }, date: { color: colors.muted, fontSize: 11 },
  card: { padding: 18, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: '#fff', gap: 12 },
  section: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  row: { paddingVertical: 11, borderTopWidth: 1, borderTopColor: colors.line, gap: 4 },
  rowTitle: { color: colors.ink, fontSize: 14, fontWeight: '700' }, link: { color: colors.magenta, fontSize: 12, fontWeight: '700' },
  error: { color: colors.red, fontSize: 13 },
});
