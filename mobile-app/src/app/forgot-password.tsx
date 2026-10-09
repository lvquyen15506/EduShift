import { useState } from 'react';
import { Link } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton } from '../components/Ui';
import { api, errorMessage } from '../lib/api';
import { colors } from '../theme';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [stage, setStage] = useState<'request' | 'confirm' | 'done'>('request');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function requestCode() {
    if (!email.includes('@')) { setError('Nhập email đã đăng ký.'); return; }
    setBusy(true); setError('');
    try {
      await api('/api/auth/password-reset/request', { method: 'POST', body: { email: email.trim().toLowerCase() } });
      setStage('confirm'); setNotice('Nếu email đã có tài khoản, mã OTP đã được gửi. Mã có hiệu lực trong 10 phút.');
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }

  async function confirm() {
    if (!/^\d{6}$/.test(code) || password.length < 6) { setError('Nhập mã OTP 6 số và mật khẩu mới từ 6 ký tự.'); return; }
    setBusy(true); setError('');
    try {
      await api('/api/auth/password-reset/confirm', { method: 'POST', body: { email: email.trim().toLowerCase(), code, new_password: password } });
      setStage('done'); setNotice('Đã đổi mật khẩu. Bạn có thể đăng nhập.');
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }

  return <SafeAreaView style={styles.safe}><KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Quên mật khẩu</Text>
      <Text style={styles.subtitle}>{stage === 'request' ? 'Nhập email đã đăng ký để nhận mã xác nhận.' : stage === 'confirm' ? `Nhập mã đã gửi đến ${email}.` : 'Mật khẩu đã được cập nhật.'}</Text>
      <View style={styles.card}>
        {stage === 'request' ? <><Text style={styles.label}>Email</Text><TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" placeholder="ban@example.com" placeholderTextColor="#9b8790" /></> : null}
        {stage === 'confirm' ? <>
          <Text style={styles.label}>Mã OTP</Text><TextInput style={styles.input} value={code} onChangeText={value => setCode(value.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" autoComplete="one-time-code" placeholder="6 chữ số" placeholderTextColor="#9b8790" />
          <Text style={styles.label}>Mật khẩu mới</Text><TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry placeholder="Ít nhất 6 ký tự" placeholderTextColor="#9b8790" />
        </> : null}
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {stage !== 'done' ? <ActionButton title={stage === 'request' ? 'Gửi mã xác nhận' : 'Đổi mật khẩu'} onPress={stage === 'request' ? requestCode : confirm} busy={busy} /> : null}
        {stage === 'confirm' ? <View style={styles.actions}><Text style={styles.link} onPress={() => { setStage('request'); setNotice(''); setError(''); }}>Sửa email</Text><Text style={styles.link} onPress={requestCode}>Gửi lại mã</Text></View> : null}
      </View>
      <Text style={styles.footer}><Link href="/login" style={styles.link}>Quay lại đăng nhập</Link></Text>
    </ScrollView>
  </KeyboardAvoidingView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas }, fill: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 14 },
  title: { color: colors.ink, fontSize: 29, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22, marginBottom: 10 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, borderRadius: 18, padding: 20, gap: 10 },
  label: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: 14, color: colors.ink, backgroundColor: '#fff' },
  notice: { color: '#17593b', fontSize: 13, lineHeight: 19 },
  error: { color: colors.red, fontSize: 13, lineHeight: 19 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 6 },
  footer: { marginTop: 10, color: colors.muted, textAlign: 'center' },
  link: { color: colors.magenta, fontWeight: '700' },
});
