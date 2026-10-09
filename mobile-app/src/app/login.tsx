import { useState } from 'react';
import { Link, Redirect, router } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton, LoadingView } from '../components/Ui';
import { errorMessage } from '../lib/api';
import { useSession } from '../lib/session';
import { colors } from '../theme';

export default function Login() {
  const { session, loading, signIn } = useSession();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (loading) return <LoadingView />;
  if (session) return <Redirect href="/(tabs)/jobs" />;

  async function submit() {
    if (!identifier.trim() || !password) { setError('Nhập tên đăng nhập và mật khẩu.'); return; }
    setBusy(true); setError('');
    try {
      await signIn(identifier.trim(), password);
      router.replace('/(tabs)/jobs');
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }

  return <SafeAreaView style={styles.safe}><KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.brand}><Text style={styles.logo}>E</Text><Text style={styles.name}>Edu<Text style={styles.nameAccent}>Shift</Text></Text></View>
      <Text style={styles.title}>Chào mừng trở lại</Text>
      <Text style={styles.subtitle}>Đăng nhập để xem ca phù hợp với lịch học của bạn.</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Tên đăng nhập hoặc email</Text>
        <TextInput style={styles.input} value={identifier} onChangeText={setIdentifier} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" placeholder="Mã sinh viên hoặc email" placeholderTextColor="#9b8790" />
        <Text style={styles.label}>Mật khẩu</Text>
        <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry placeholder="Mật khẩu EduShift" placeholderTextColor="#9b8790" />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <ActionButton title="Đăng nhập" onPress={submit} busy={busy} />
      </View>
      <Text style={styles.footer}>Chưa có tài khoản? <Link href="/register" style={styles.link}>Đăng ký sinh viên</Link></Text>
    </ScrollView>
  </KeyboardAvoidingView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  fill: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 14 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 24 },
  logo: { width: 40, height: 40, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.magenta, color: '#fff', textAlign: 'center', textAlignVertical: 'center', fontSize: 24, fontWeight: '800' },
  name: { color: colors.ink, fontSize: 24, fontWeight: '800' },
  nameAccent: { color: colors.magenta },
  title: { color: colors.ink, fontSize: 29, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22, marginBottom: 10 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, borderRadius: 18, padding: 20, gap: 10 },
  label: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: 14, color: colors.ink, backgroundColor: '#fff' },
  error: { color: colors.red, fontSize: 13, lineHeight: 19 },
  footer: { marginTop: 10, color: colors.muted, textAlign: 'center' },
  link: { color: colors.magenta, fontWeight: '700' },
});
