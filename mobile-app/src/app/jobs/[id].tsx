import { useCallback, useState } from 'react';
import { Redirect, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ActionButton, LoadingView, Notice } from '../../components/Ui';
import { api, errorMessage } from '../../lib/api';
import { useSession } from '../../lib/session';
import type { ShiftDetail } from '../../lib/types';
import { colors } from '../../theme';

export default function JobDetail() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { session, loading: sessionLoading } = useSession();
  const [shift, setShift] = useState<ShiftDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!session || !id) return;
    setLoading(true);
    try {
      const next = await api<ShiftDetail>('/api/shifts/' + encodeURIComponent(id), { token: session.access_token });
      setShift(next); setError('');
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setLoading(false); }
  }, [id, session]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (sessionLoading) return <LoadingView />;
  if (!session) return <Redirect href="/login" />;
  if (loading && !shift) return <LoadingView />;
  if (!shift) return <Notice title="Không tải được ca làm" detail={error} onRetry={() => { void load(); }} />;

  const canApply = shift.status === 'OPEN' && shift.available && !shift.applied;
  async function apply() {
    if (!session || !shift || busy || !canApply) return;
    setBusy(true); setError('');
    try {
      await api('/api/applications', { method: 'POST', body: { shift_id: shift.id }, token: session.access_token });
      setShift(current => current ? { ...current, applied: true } : current);
      Alert.alert('Ứng tuyển thành công', 'Doanh nghiệp đã nhận được đơn của bạn.');
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <View style={styles.hero}><Text style={styles.company}>{shift.company_name}</Text><Text style={styles.title}>{shift.title}</Text><Text style={styles.location}>⌖ {shift.location}</Text><View style={styles.score}><Text style={styles.scoreText}>{shift.match_score}% phù hợp với bạn</Text></View></View>
    <View style={styles.card}><Text style={styles.section}>Thông tin ca làm</Text><Text style={styles.line}>◷ {new Date(shift.start_time).toLocaleString('vi-VN', { dateStyle: 'full', timeStyle: 'short' })}</Text><Text style={styles.line}>Kết thúc: {new Date(shift.end_time).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' })}</Text><Text style={styles.line}>Thu nhập: {Number(shift.hourly_rate || 0).toLocaleString('vi-VN')} đ/giờ</Text><Text style={styles.line}>Cần tuyển: {shift.required_workers} người</Text></View>
    <View style={styles.card}><Text style={styles.section}>Mô tả công việc</Text><Text style={styles.body}>{shift.description || 'Doanh nghiệp chưa cập nhật mô tả.'}</Text>{shift.required_skills.length ? <><Text style={styles.section}>Kỹ năng cần có</Text><View style={styles.tags}>{shift.required_skills.map(skill => <Text style={styles.tag} key={skill}>{skill}</Text>)}</View></> : null}</View>
    <View style={styles.card}><Text style={styles.section}>Vì sao phù hợp?</Text>{shift.match_reasons.map(reason => <Text style={styles.reason} key={reason}>✓ {reason}</Text>)}</View>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <ActionButton title={shift.applied ? 'Đã ứng tuyển ca này' : canApply ? 'Ứng tuyển ngay' : 'Ca này chưa thể ứng tuyển'} onPress={apply} disabled={!canApply} busy={busy} />
  </ScrollView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 18, gap: 14, paddingBottom: 40 },
  hero: { padding: 22, borderRadius: 18, backgroundColor: colors.blush, gap: 8 },
  company: { color: colors.magenta, fontSize: 13, fontWeight: '800' },
  title: { color: colors.ink, fontSize: 25, fontWeight: '800' },
  location: { color: colors.muted, fontSize: 13 },
  score: { alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.mint },
  scoreText: { color: colors.green, fontSize: 13, fontWeight: '800' },
  card: { padding: 19, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: '#fff', gap: 10 },
  section: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  line: { color: colors.muted, fontSize: 13, lineHeight: 21 },
  body: { color: colors.muted, fontSize: 14, lineHeight: 22 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  tag: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 7, backgroundColor: colors.blush, color: colors.magenta, fontSize: 12, fontWeight: '700' },
  reason: { color: colors.green, fontSize: 13, lineHeight: 20 },
  error: { color: colors.red, fontSize: 13, lineHeight: 20 },
});
