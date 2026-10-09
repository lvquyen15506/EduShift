import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Alert, FlatList, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { ActionButton, LoadingView, Notice } from '../../components/Ui';
import { api, errorMessage } from '../../lib/api';
import { useSession } from '../../lib/session';
import { parseScheduleCsv, type ImportedSchedule } from '../../lib/schedule-file';
import type { ScheduleItem } from '../../lib/types';
import { colors } from '../../theme';

type ScheduleType = ScheduleItem['type'];
const typeLabels: Record<ScheduleType, string> = { STUDY: 'Lịch học', BUSY: 'Bận', FREE: 'Rảnh', WORK: 'Ca làm' };
const today = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
function localDateTime(date: string, time: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const parsed = new Date(date + 'T' + time + ':00');
  const [year, month, day] = date.split('-').map(Number);
  if (Number.isNaN(parsed.getTime()) || parsed.getFullYear() !== year || parsed.getMonth() + 1 !== month || parsed.getDate() !== day) return null;
  return parsed;
}

export default function Schedule() {
  const { session } = useSession();
  const [items, setItems] = useState<ScheduleItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [type, setType] = useState<ScheduleType>('STUDY');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(today());
  const [start, setStart] = useState('08:00');
  const [end, setEnd] = useState('10:00');
  const [schoolUser, setSchoolUser] = useState('');
  const [schoolPass, setSchoolPass] = useState('');
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (!session) return;
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const next = await api<ScheduleItem[]>('/api/schedules', { token: session.access_token });
      setItems(next); setError('');
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setLoading(false); setRefreshing(false); }
  }, [session]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function addManual() {
    if (!session || busy) return;
    const from = localDateTime(date, start);
    const until = localDateTime(date, end);
    if (!from || !until || until <= from) { setFormError('Nhập ngày YYYY-MM-DD và giờ HH:mm; giờ kết thúc phải sau giờ bắt đầu.'); return; }
    if (type !== 'FREE' && !title.trim()) { setFormError('Nhập tên lịch học hoặc việc bận.'); return; }
    setBusy(true); setFormError('');
    try {
      await api('/api/schedules', { method: 'POST', token: session.access_token, body: { title: title.trim() || 'Rảnh', type, start_time: from.toISOString(), end_time: until.toISOString() } });
      setManualOpen(false); setTitle(''); await load(true);
    } catch (cause) { setFormError(errorMessage(cause)); }
    finally { setBusy(false); }
  }

  async function syncSchool() {
    if (!session || busy) return;
    if (!schoolUser.trim() || !schoolPass) { setFormError('Nhập tài khoản và mật khẩu cổng trường.'); return; }
    setBusy(true); setFormError('');
    try {
      const result = await api<{ synced: number }>('/api/schedules/sync-school', { method: 'POST', token: session.access_token, body: { username: schoolUser.trim(), password: schoolPass } });
      setSyncOpen(false); setSchoolUser(''); setSchoolPass(''); await load(true);
      Alert.alert('Đồng bộ xong', 'Đã cập nhật ' + result.synced + ' buổi học từ cổng trường.');
    } catch (cause) { setFormError(errorMessage(cause)); }
    finally { setBusy(false); }
  }

  async function importFile(rows: ImportedSchedule[]) {
    if (!session || busy) return;
    setBusy(true);
    try {
      const result = await api<{ imported: number; skipped: number }>('/api/schedules/import', { method: 'POST', token: session.access_token, body: { items: rows, replace: false } });
      await load(true);
      Alert.alert('Nhập lịch xong', `Đã thêm ${result.imported} mục, bỏ qua ${result.skipped} mục trùng.`);
    } catch (cause) { Alert.alert('Không thể nhập lịch', errorMessage(cause)); }
    finally { setBusy(false); }
  }

  async function chooseFile() {
    if (busy) return;
    try {
      const picked = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (picked.canceled) return;
      const asset = picked.assets[0];
      if (!asset.name.toLowerCase().endsWith('.csv')) throw new Error('Chọn file CSV có các cột title,date,start,end,type.');
      if (asset.size && asset.size > 1_000_000) throw new Error('File CSV cần nhỏ hơn 1 MB.');
      const content = asset.file ? await asset.file.text() : await new File(asset.uri).text();
      const rows = parseScheduleCsv(content);
      Alert.alert('Xem trước file lịch', `${asset.name}: ${rows.length} mục hợp lệ. Giờ trong file được hiểu theo múi giờ Việt Nam.`, [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Nhập lịch', onPress: () => { void importFile(rows); } },
      ]);
    } catch (cause) { Alert.alert('File lịch không hợp lệ', errorMessage(cause)); }
  }

  function remove(item: ScheduleItem) {
    if (!session || item.source === 'SHIFT') return;
    Alert.alert('Xóa mục lịch?', item.title || typeLabels[item.type], [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Xóa', style: 'destructive', onPress: () => {
        void (async () => {
          try { await api<void>('/api/schedules/' + encodeURIComponent(item.id), { method: 'DELETE', token: session.access_token }); await load(true); }
          catch (cause) { Alert.alert('Không thể xóa lịch', errorMessage(cause)); }
        })();
      } },
    ]);
  }

  function closeSync() { setSyncOpen(false); setSchoolUser(''); setSchoolPass(''); setFormError(''); }
  function closeManual() { setManualOpen(false); setFormError(''); }

  if (loading && !items) return <LoadingView />;
  if (error && !items) return <Notice title="Không tải được lịch học" detail={error} onRetry={() => { void load(); }} />;
  return <View style={styles.screen}>
    <FlatList
      data={items || []}
      keyExtractor={item => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void load(true); }} tintColor={colors.magenta} />}
      contentContainerStyle={styles.content}
      ListHeaderComponent={<View><Text style={styles.eyebrow}>THỜI GIAN CỦA BẠN</Text><Text style={styles.heading}>Lịch học & lịch rảnh</Text><Text style={styles.subtitle}>EduShift dùng lịch này để loại ca trùng giờ học và gợi ý việc phù hợp.</Text><View style={styles.actions}><ActionButton title="Đồng bộ lịch trường" onPress={() => { setFormError(''); setSyncOpen(true); }} /><ActionButton title="Nhập lịch từ file CSV" secondary onPress={() => { void chooseFile(); }} busy={busy} /><ActionButton title="Thêm lịch thủ công" secondary onPress={() => { setFormError(''); setManualOpen(true); }} /></View>{error ? <Text style={styles.error}>{error}</Text> : null}<Text style={styles.section}>Các mục lịch ({items?.length || 0})</Text></View>}
      ListEmptyComponent={<Notice title="Chưa có lịch" detail="Đồng bộ lịch trường hoặc thêm khoảng bận, rảnh để nhận gợi ý chính xác hơn." />}
      renderItem={({ item }) => <View style={styles.card}><View style={styles.row}><Text style={styles.cardTitle}>{item.title || typeLabels[item.type]}</Text><Text style={[styles.badge, item.type === 'FREE' && styles.freeBadge, item.type === 'WORK' && styles.workBadge]}>{typeLabels[item.type]}</Text></View><Text style={styles.time}>{new Date(item.start_time).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' })} – {new Date(item.end_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</Text><View style={styles.row}><Text style={styles.source}>{item.source === 'SCHOOL' ? 'Từ cổng trường' : item.source === 'SHIFT' ? 'Đã nhận ca' : 'Tự thêm'}</Text>{item.source !== 'SHIFT' && <Pressable accessibilityRole="button" onPress={() => remove(item)}><Text style={styles.remove}>Xóa</Text></Pressable>}</View>{item.shift_id && <Pressable accessibilityRole="button" onPress={() => router.push('/jobs/' + item.shift_id)}><Text style={styles.remove}>Xem ca và chấm công →</Text></Pressable>}</View>}
    />
    <Modal visible={manualOpen} animationType="slide" transparent onRequestClose={closeManual}><View style={styles.overlay}><ScrollView contentContainerStyle={styles.modal}><Text style={styles.modalTitle}>Thêm lịch thủ công</Text><Text style={styles.hint}>Chọn loại lịch để EduShift hiểu lúc nào bạn bận hoặc rảnh.</Text><View style={styles.typeRow}>{(['STUDY', 'BUSY', 'FREE'] as ScheduleType[]).map(value => <Pressable accessibilityRole="button" key={value} onPress={() => setType(value)} style={[styles.typeButton, type === value && styles.typeActive]}><Text style={[styles.typeText, type === value && styles.typeActiveText]}>{typeLabels[value]}</Text></Pressable>)}</View><Text style={styles.label}>Tên mục lịch</Text><TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder={type === 'FREE' ? 'Rảnh (có thể để trống)' : 'Ví dụ: Toán cao cấp'} placeholderTextColor="#9b8790" /><Text style={styles.label}>Ngày (YYYY-MM-DD)</Text><TextInput style={styles.input} value={date} onChangeText={setDate} keyboardType="numbers-and-punctuation" placeholder="2026-10-12" placeholderTextColor="#9b8790" /><View style={styles.timeRow}><View style={styles.timeField}><Text style={styles.label}>Bắt đầu (HH:mm)</Text><TextInput style={styles.input} value={start} onChangeText={setStart} keyboardType="numbers-and-punctuation" placeholder="08:00" placeholderTextColor="#9b8790" /></View><View style={styles.timeField}><Text style={styles.label}>Kết thúc (HH:mm)</Text><TextInput style={styles.input} value={end} onChangeText={setEnd} keyboardType="numbers-and-punctuation" placeholder="10:00" placeholderTextColor="#9b8790" /></View></View>{formError ? <Text style={styles.error}>{formError}</Text> : null}<ActionButton title="Lưu vào lịch" onPress={() => { void addManual(); }} busy={busy} /><ActionButton title="Hủy" secondary onPress={closeManual} /></ScrollView></View></Modal>
    <Modal visible={syncOpen} animationType="slide" transparent onRequestClose={closeSync}><View style={styles.overlay}><ScrollView contentContainerStyle={styles.modal}><Text style={styles.modalTitle}>Đồng bộ lịch trường</Text><Text style={styles.hint}>Thông tin cổng trường chỉ dùng cho lần đồng bộ này và không được lưu trong ứng dụng.</Text><Text style={styles.label}>Tài khoản cổng trường</Text><TextInput style={styles.input} value={schoolUser} onChangeText={setSchoolUser} autoCapitalize="none" placeholder="Mã sinh viên" placeholderTextColor="#9b8790" /><Text style={styles.label}>Mật khẩu cổng trường</Text><TextInput style={styles.input} value={schoolPass} onChangeText={setSchoolPass} secureTextEntry placeholder="Mật khẩu" placeholderTextColor="#9b8790" />{formError ? <Text style={styles.error}>{formError}</Text> : null}<ActionButton title="Đồng bộ ngay" onPress={() => { void syncSchool(); }} busy={busy} /><ActionButton title="Hủy" secondary onPress={closeSync} /></ScrollView></View></Modal>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 18, paddingBottom: 40 },
  eyebrow: { color: colors.magenta, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  heading: { marginTop: 6, color: colors.ink, fontSize: 27, fontWeight: '800' },
  subtitle: { marginTop: 6, color: colors.muted, fontSize: 14, lineHeight: 21 },
  actions: { gap: 9, marginTop: 20 },
  section: { marginTop: 25, marginBottom: 12, color: colors.ink, fontSize: 18, fontWeight: '800' },
  card: { marginBottom: 11, padding: 16, borderWidth: 1, borderColor: colors.line, borderRadius: 15, backgroundColor: '#fff', gap: 9 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  cardTitle: { flex: 1, color: colors.ink, fontSize: 15, fontWeight: '700' },
  badge: { overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 20, backgroundColor: colors.blush, color: colors.magenta, fontSize: 11, fontWeight: '700' },
  freeBadge: { backgroundColor: colors.mint, color: colors.green },
  workBadge: { backgroundColor: '#eae4ff', color: '#6546a2' },
  time: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  source: { color: colors.muted, fontSize: 11 },
  remove: { color: colors.red, fontSize: 12, fontWeight: '700' },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#25181d77' },
  modal: { gap: 10, padding: 22, paddingBottom: 38, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: '#fff' },
  modalTitle: { color: colors.ink, fontSize: 21, fontWeight: '800' },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  label: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  input: { minHeight: 46, borderWidth: 1, borderColor: colors.line, borderRadius: 9, paddingHorizontal: 13, color: colors.ink },
  typeRow: { flexDirection: 'row', gap: 7, marginVertical: 6 },
  typeButton: { flex: 1, paddingVertical: 10, borderRadius: 9, backgroundColor: colors.canvas, alignItems: 'center' },
  typeActive: { backgroundColor: colors.magenta },
  typeText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  typeActiveText: { color: '#fff' },
  timeRow: { flexDirection: 'row', gap: 10 },
  timeField: { flex: 1, gap: 6 },
  error: { color: colors.red, fontSize: 13, lineHeight: 19 },
});
