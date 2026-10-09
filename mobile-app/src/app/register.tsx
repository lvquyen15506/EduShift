import { useState } from 'react';
import { Link, Redirect, router } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton, LoadingView } from '../components/Ui';
import { errorMessage } from '../lib/api';
import { useSession } from '../lib/session';
import { colors } from '../theme';

export default function Register() {
  const { session, loading, signUp, verifySignUp } = useSession();
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'details' | 'verify'>('details');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (loading) return <LoadingView />;
  if (session) return <Redirect href="/(tabs)/jobs" />;

  async function submit() {
    if (!fullName.trim() || !username.trim() || !email.trim() || password.length < 6) { setError('Nhập họ tên, mã đăng nhập, email và mật khẩu từ 6 ký tự.'); return; }
    setBusy(true); setError('');
    try {
      await signUp(fullName.trim(), username.trim(), email.trim().toLowerCase(), password);
      setStage('verify'); setNotice('Mã OTP đã gửi đến email. Mã có hiệu lực trong 10 phút.');
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }

  async function verify() {
    if (!/^\d{6}$/.test(code)) { setError('Nhập mã OTP gồm 6 chữ số.'); return; }
    setBusy(true); setError('');
    try { await verifySignUp(email.trim().toLowerCase(), code, username.trim()); router.replace('/(tabs)/jobs'); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }

  return <SafeAreaView style={styles.safe}><KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.eyebrow}>BẮT ĐẦU VỚI EDUSHIFT</Text>
      <Text style={styles.title}>{stage === 'details' ? 'Tạo tài khoản sinh viên' : 'Xác nhận email'}</Text>
      <Text style={styles.subtitle}>{stage === 'details' ? 'Tìm ca làm phù hợp với thời gian học của bạn.' : `Nhập mã 6 số đã gửi tới ${email}.`}</Text>
      <View style={styles.card}>
        {stage === 'details' ? <>
        <Text style={styles.label}>Họ và tên</Text>
        <TextInput style={styles.input} value={fullName} onChangeText={setFullName} autoCapitalize="words" placeholder="Nguyễn Văn A" placeholderTextColor="#9b8790" />
        <Text style={styles.label}>Tên đăng nhập / mã sinh viên</Text>
        <TextInput style={styles.input} value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} placeholder="Mã sinh viên" placeholderTextColor="#9b8790" />
        <Text style={styles.label}>Email nhận mã OTP</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" placeholder="ban@example.com" placeholderTextColor="#9b8790" />
        <Text style={styles.label}>Mật khẩu EduShift</Text>
        <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry placeholder="Ít nhất 6 ký tự" placeholderTextColor="#9b8790" />
        </> : <><Text style={styles.label}>Mã OTP</Text><TextInput style={styles.input} value={code} onChangeText={value => setCode(value.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" autoComplete="one-time-code" placeholder="6 chữ số" placeholderTextColor="#9b8790" /></>}
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <ActionButton title={stage === 'details' ? 'Gửi mã xác nhận' : 'Xác nhận và tạo tài khoản'} onPress={stage === 'details' ? submit : verify} busy={busy} />
        {stage === 'verify' ? <View style={styles.actions}><Text style={styles.link} onPress={() => { setStage('details'); setError(''); setNotice(''); }}>Sửa thông tin</Text><Text style={styles.link} onPress={submit}>Gửi lại mã</Text></View> : null}
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
  notice: { color: '#17593b', fontSize: 13, lineHeight: 19 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 6 },
  footer: { marginTop: 10, color: colors.muted, textAlign: 'center' },
  link: { color: colors.magenta, fontWeight: '700' },
});
