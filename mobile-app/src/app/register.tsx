import { useState } from 'react';
import { Link, Redirect, router } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton, LoadingView } from '../components/Ui';
import { errorMessage } from '../lib/api';
import { useSession } from '../lib/session';
import { colors } from '../theme';

export default function Register() {
  const { session, loading, signUp } = useSession();
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (loading) return <LoadingView />;
  if (session) return <Redirect href="/(tabs)/jobs" />;

  async function submit() {
    if (!fullName.trim() || !username.trim() || password.length < 6) { setError('Nhập họ tên, mã đăng nhập và mật khẩu từ 6 ký tự.'); return; }
    setBusy(true); setError('');
    try {
      await signUp(fullName.trim(), username.trim(), password);
      router.replace('/(tabs)/jobs');
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }

  return <SafeAreaView style={styles.safe}><KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.eyebrow}>BẮT ĐẦU VỚI EDUSHIFT</Text>
      <Text style={styles.title}>Tạo tài khoản sinh viên</Text>
      <Text style={styles.subtitle}>Tìm ca làm phù hợp với thời gian học của bạn.</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Họ và tên</Text>
        <TextInput style={styles.input} value={fullName} onChangeText={setFullName} autoCapitalize="words" placeholder="Nguyễn Văn A" placeholderTextColor="#9b8790" />
        <Text style={styles.label}>Tên đăng nhập / mã sinh viên</Text>
        <TextInput style={styles.input} value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} placeholder="Mã sinh viên" placeholderTextColor="#9b8790" />
        <Text style={styles.label}>Mật khẩu EduShift</Text>
        <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry placeholder="Ít nhất 6 ký tự" placeholderTextColor="#9b8790" />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <ActionButton title="Tạo tài khoản" onPress={submit} busy={busy} />
      </View>
      <Text style={styles.footer}>Đã có tài khoản? <Link href="/login" style={styles.link}>Đăng nhập</Link></Text>
    </ScrollView>
  </KeyboardAvoidingView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  fill: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 14 },
  eyebrow: { color: colors.magenta, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  title: { color: colors.ink, fontSize: 29, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22, marginBottom: 10 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, borderRadius: 18, padding: 20, gap: 10 },
  label: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: 14, color: colors.ink, backgroundColor: '#fff' },
  error: { color: colors.red, fontSize: 13, lineHeight: 19 },
  footer: { marginTop: 10, color: colors.muted, textAlign: 'center' },
  link: { color: colors.magenta, fontWeight: '700' },
});
