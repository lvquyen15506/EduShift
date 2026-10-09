import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Image, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ActionButton, LoadingView, Notice } from '../../components/Ui';
import { api, errorMessage } from '../../lib/api';
import { useSession } from '../../lib/session';
import { colors } from '../../theme';

type StudentAccount = {
  username: string | null;
  email: string | null;
  avatar_data: string | null;
  profile: { full_name: string; phone: string | null; university: string | null; major: string | null; skills: string | null };
};
type Field = 'full_name' | 'phone' | 'university' | 'major' | 'skills' | 'email';
const labels: [Field, string][] = [
  ['full_name', 'Họ và tên'], ['email', 'Email'], ['phone', 'Số điện thoại'],
  ['university', 'Trường học'], ['major', 'Ngành học'], ['skills', 'Kỹ năng (ngăn cách bằng dấu phẩy)'],
];

export default function Profile() {
  const { session, signOut } = useSession();
  const [account, setAccount] = useState<StudentAccount | null>(null);
  const [fields, setFields] = useState<Record<Field, string>>({ full_name: '', email: '', phone: '', university: '', major: '', skills: '' });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const next = await api<StudentAccount>('/api/auth/me', { token: session.access_token });
      setAccount(next);
      setFields({ full_name: next.profile.full_name || '', email: next.email || '', phone: next.profile.phone || '', university: next.profile.university || '', major: next.profile.major || '', skills: next.profile.skills || '' });
      setError('');
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setLoading(false); }
  }, [session]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function save() {
    if (!session || busy) return;
    if (!fields.full_name.trim()) { setError('Họ và tên không được để trống.'); return; }
    setBusy(true); setError(''); setSuccess('');
    try {
      const next = await api<StudentAccount>('/api/auth/profile', { method: 'PATCH', token: session.access_token, body: {
        full_name: fields.full_name.trim(), email: fields.email.trim() || null,
        phone: fields.phone.trim(), university: fields.university.trim(),
        major: fields.major.trim(), skills: fields.skills.trim(),
      } });
      setAccount(next); setSuccess('Đã lưu hồ sơ.');
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }

  async function chooseAvatar() {
    if (!session || busy) return;
    setBusy(true); setError(''); setSuccess('');
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) throw new Error('Hãy cho phép truy cập ảnh để đổi ảnh đại diện.');
      const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      if (picked.canceled) return;
      const context = ImageManipulator.manipulate(picked.assets[0].uri);
      context.resize({ width: 320, height: 320 });
      const rendered = await context.renderAsync();
      const image = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.75, base64: true });
      if (!image.base64) throw new Error('Không đọc được ảnh đã chọn.');
      const next = await api<StudentAccount>('/api/auth/avatar', { method: 'PATCH', token: session.access_token, body: { avatar_data: `data:image/jpeg;base64,${image.base64}` } });
      setAccount(next); setSuccess('Đã đổi ảnh đại diện.');
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }

  if (loading && !account) return <LoadingView />;
  if (!account) return <Notice title="Không tải được hồ sơ" detail={error} onRetry={() => { void load(); }} />;
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Text style={styles.eyebrow}>TÀI KHOẢN SINH VIÊN</Text><Text style={styles.heading}>Hồ sơ của tôi</Text>
    <View style={styles.avatarBox}>{account.avatar_data ? <Image source={{ uri: account.avatar_data }} style={styles.avatar} /> : <View style={styles.avatarFallback}><Text style={styles.initial}>{account.profile.full_name.trim().slice(0, 1).toUpperCase()}</Text></View>}<Text style={styles.username}>{account.username || account.email}</Text><ActionButton title="Đổi ảnh đại diện" secondary onPress={() => { void chooseAvatar(); }} busy={busy} /></View>
    <View style={styles.card}>{labels.map(([key, label]) => <View key={key}><Text style={styles.label}>{label}</Text><TextInput style={styles.input} value={fields[key]} onChangeText={value => setFields(current => ({ ...current, [key]: value }))} autoCapitalize={key === 'email' ? 'none' : 'sentences'} keyboardType={key === 'email' ? 'email-address' : key === 'phone' ? 'phone-pad' : 'default'} /></View>)}
      {error ? <Text style={styles.error}>{error}</Text> : null}{success ? <Text style={styles.success}>{success}</Text> : null}<ActionButton title="Lưu hồ sơ" onPress={() => { void save(); }} busy={busy} /></View>
    <ActionButton title="Đăng xuất" secondary onPress={() => { void signOut(); }} />
  </ScrollView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas }, content: { padding: 18, paddingBottom: 42, gap: 14 },
  eyebrow: { color: colors.magenta, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  heading: { color: colors.ink, fontSize: 29, fontWeight: '800' },
  avatarBox: { alignItems: 'center', gap: 10, padding: 20, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: colors.line },
  avatar: { width: 92, height: 92, borderRadius: 46 }, avatarFallback: { width: 92, height: 92, borderRadius: 46, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
  initial: { color: colors.magenta, fontSize: 34, fontWeight: '800' }, username: { color: colors.muted, fontSize: 13 },
  card: { padding: 18, gap: 13, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: colors.line },
  label: { color: colors.ink, fontWeight: '700', fontSize: 12, marginBottom: 6 }, input: { minHeight: 45, borderWidth: 1, borderColor: colors.line, borderRadius: 9, paddingHorizontal: 12, color: colors.ink },
  error: { color: colors.red, fontSize: 13 }, success: { color: colors.green, fontSize: 13 },
});
