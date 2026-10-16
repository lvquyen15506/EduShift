import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { api, errorMessage } from '../../lib/api';
import { useSession } from '../../lib/session';
import { colors } from '../../theme';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

export default function AssistantScreen() {
  const { session } = useSession();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  useFocusEffect(useCallback(() => {
    if (!session) return;
    let active = true;
    setLoading(true);
    setMessages([]);
    api<ChatMessage[]>('/api/chat/history', { token: session.access_token })
      .then(history => { if (active) { setMessages(history); setError(''); } })
      .catch(cause => { if (active) setError(errorMessage(cause)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [session]));

  async function send() {
    const message = input.trim();
    if (!session || !message || sending) return;
    const previous = messages;
    const next: ChatMessage[] = [...previous, { role: 'user', content: message }];
    setMessages(next); setInput(''); setSending(true); setError('');
    try {
      const result = await api<{ answer: string }>('/api/chat', {
        method: 'POST', token: session.access_token, body: { message, history: next.slice(-8) },
      });
      setMessages([...next, { role: 'assistant', content: result.answer }]);
    } catch (cause) {
      setMessages(previous); setInput(message); setError(errorMessage(cause));
    } finally { setSending(false); }
  }

  function confirmClear() {
    if (!session || !messages.length || sending) return;
    Alert.alert('Xóa cuộc trò chuyện?', 'Tin nhắn của tài khoản sẽ bị xóa trên web và mobile.', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Xóa', style: 'destructive', onPress: async () => {
        try { await api('/api/chat/history', { method: 'DELETE', token: session.access_token }); setMessages([]); setError(''); }
        catch (cause) { setError(errorMessage(cause)); }
      } },
    ]);
  }

  return <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={styles.header}><View><Text style={styles.title}>Trợ lý EduShift</Text><Text style={styles.subtitle}>Tư vấn ca làm theo lịch của bạn</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Xóa cuộc trò chuyện" disabled={!messages.length || sending} onPress={confirmClear} style={styles.clear}><Ionicons name="trash-outline" size={21} color={messages.length ? colors.magenta : colors.muted} /></Pressable></View>
    <ScrollView ref={scrollRef} style={styles.list} contentContainerStyle={styles.messages} onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })} keyboardShouldPersistTaps="handled">
      {!messages.length && !loading ? <View style={styles.bubble}><Text style={styles.assistantText}>Chào bạn! Mình có thể xem lịch học và ca đã nhận để gợi ý ca làm phù hợp. Bạn muốn sắp xếp tuần này thế nào?</Text></View> : null}
      {messages.map((item, index) => <View key={index} style={[styles.bubble, item.role === 'user' && styles.userBubble]}><Text style={item.role === 'user' ? styles.userText : styles.assistantText}>{item.content}</Text></View>)}
      {loading || sending ? <ActivityIndicator color={colors.magenta} style={styles.wait} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </ScrollView>
    <View style={styles.composer}><TextInput style={styles.input} value={input} onChangeText={setInput} placeholder="Hỏi về lịch học hoặc ca làm..." placeholderTextColor={colors.muted} maxLength={2000} multiline accessibilityLabel="Nội dung tin nhắn" />
      <Pressable accessibilityRole="button" accessibilityLabel="Gửi tin nhắn" disabled={!input.trim() || sending} onPress={() => { void send(); }} style={[styles.send, (!input.trim() || sending) && styles.disabled]}><Ionicons name="send" size={19} color="#fff" /></Pressable></View>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas }, header: { paddingHorizontal: 18, paddingVertical: 15, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.line },
  title: { color: colors.ink, fontSize: 20, fontWeight: '800' }, subtitle: { color: colors.muted, fontSize: 12, marginTop: 3 }, clear: { padding: 9 },
  list: { flex: 1 }, messages: { padding: 16, gap: 12, flexGrow: 1 }, bubble: { alignSelf: 'flex-start', maxWidth: '89%', padding: 13, borderRadius: 15, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line },
  userBubble: { alignSelf: 'flex-end', backgroundColor: colors.magenta, borderColor: colors.magenta }, assistantText: { color: colors.ink, fontSize: 14, lineHeight: 21 }, userText: { color: '#fff', fontSize: 14, lineHeight: 21 },
  wait: { alignSelf: 'flex-start', marginVertical: 8 }, error: { color: colors.red, fontSize: 12, lineHeight: 18 }, composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 9, padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: colors.line },
  input: { flex: 1, maxHeight: 110, minHeight: 44, paddingHorizontal: 13, paddingVertical: 10, borderWidth: 1, borderColor: colors.line, borderRadius: 12, color: colors.ink, fontSize: 14 },
  send: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.magenta, alignItems: 'center', justifyContent: 'center' }, disabled: { opacity: 0.45 },
});
