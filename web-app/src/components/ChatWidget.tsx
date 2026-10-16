'use client';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { CloseOutlined, DeleteOutlined, MessageOutlined, RobotOutlined, SendOutlined } from '@ant-design/icons';
import { api } from '@/lib/api';

type ChatMessage = { role: 'user' | 'assistant'; content: string };
type ChatResponse = { answer: string };
const GUEST_KEY = 'edushift.guest.chat';

function guestHistory(): ChatMessage[] {
  try {
    const saved = JSON.parse(localStorage.getItem(GUEST_KEY) || '[]');
    return Array.isArray(saved) ? saved.filter(item => (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string').slice(-100) : [];
  } catch { return []; }
}

export default function ChatWidget({ support = false }: { support?: boolean }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [authenticated, setAuthenticated] = useState(support);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [historyError, setHistoryError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      let token = '';
      try { token = JSON.parse(localStorage.getItem('user') || '{}').access_token || ''; } catch { /* Guest session. */ }
      if (accountRef.current === token) return;
      accountRef.current = token;
      setAuthenticated(Boolean(token));
      setHistoryError('');
      if (!token) {
        setMessages(guestHistory());
        return;
      }
      setMessages([]);
      try {
        const history = await api<ChatMessage[]>('/api/chat/history');
        if (active && accountRef.current === token) setMessages(history);
      } catch {
        if (active && accountRef.current === token) setHistoryError('Chưa tải được lịch sử chat. Bạn có thể thử mở lại.');
      }
    };
    window.addEventListener('edushift-account-updated', refresh);
    window.addEventListener('storage', refresh);
    void refresh();
    return () => { active = false; window.removeEventListener('edushift-account-updated', refresh); window.removeEventListener('storage', refresh); };
  }, []);
  useEffect(() => { if (open) bottomRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }); }, [messages, loading, open]);

  const append = (next: ChatMessage[]) => {
    setMessages(next);
    if (!authenticated) localStorage.setItem(GUEST_KEY, JSON.stringify(next.slice(-100)));
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const message = input.trim();
    if (!message || loading) return;
    const next: ChatMessage[] = [...messages, { role: 'user', content: message }];
    append(next); setInput(''); setLoading(true); setHistoryError('');
    try {
      const result = await api<ChatResponse>('/api/chat', { method: 'POST', body: JSON.stringify({ message, history: next.slice(-8) }) });
      append([...next, { role: 'assistant', content: result.answer }]);
    } catch {
      setHistoryError('Mình chưa kết nối được máy chủ. Bạn thử gửi lại sau ít phút nhé.');
      append(messages);
      setInput(message);
    } finally { setLoading(false); }
  };
  const clear = async () => {
    if (loading || !window.confirm('Xóa toàn bộ cuộc trò chuyện này?')) return;
    try {
      if (authenticated) await api('/api/chat/history', { method: 'DELETE' });
      else localStorage.removeItem(GUEST_KEY);
      setMessages([]); setHistoryError('');
    } catch { setHistoryError('Chưa xóa được cuộc trò chuyện. Bạn thử lại nhé.'); }
  };
  const welcome = authenticated ? 'Chào bạn! Mình có thể xem lịch học và ca đã nhận để tư vấn ca phù hợp. Bạn cần giúp gì?' : 'Chào bạn! Mình có thể giúp bạn khám phá EduShift và tìm những ca đang tuyển.';
  return <div className="chat-widget">
    {!open && <button className="chat-launcher" type="button" aria-label="Mở trợ lý EduShift" onClick={() => setOpen(true)}><MessageOutlined /><span>Trợ lý EduShift</span></button>}
    {open && <section className="chat-panel" aria-label="Trợ lý EduShift">
      <header className="chat-panel-head"><div className="chat-panel-identity"><span className="chat-avatar"><RobotOutlined /></span><span><b>{authenticated ? 'Hỗ trợ EduShift' : 'Tư vấn EduShift'}</b><small><i /> Sẵn sàng hỗ trợ bạn</small></span></div><div className="chat-head-actions"><button type="button" aria-label="Xóa cuộc trò chuyện" title="Xóa cuộc trò chuyện" onClick={() => void clear()} disabled={!messages.length || loading}><DeleteOutlined /></button><button className="chat-close" type="button" aria-label="Đóng trợ lý" onClick={() => setOpen(false)}><CloseOutlined /></button></div></header>
      <div className="chat-messages" role="log" aria-live="polite" aria-relevant="additions text">
        {!messages.length && <div className="chat-message assistant"><span className="chat-message-avatar"><RobotOutlined /></span><p>{welcome}</p></div>}
        {messages.map((item, index) => <div className={'chat-message ' + item.role} key={index}>{item.role === 'assistant' && <span className="chat-message-avatar"><RobotOutlined /></span>}<p>{item.content}</p></div>)}
        {historyError && <p className="chat-error" role="alert">{historyError}</p>}
        {loading && <div className="chat-message assistant chat-pending" role="status" aria-label="Trợ lý đang trả lời"><span className="chat-message-avatar"><RobotOutlined /></span><p><span className="chat-typing"><i /><i /><i /></span><span className="chat-pending-label">Đang soạn câu trả lời...</span></p></div>}
        <div ref={bottomRef} />
      </div>
      <form className="chat-compose" onSubmit={submit}><input value={input} onChange={event => setInput(event.target.value)} placeholder={authenticated ? 'Bạn cần hỗ trợ điều gì?' : 'Bạn muốn tìm công việc nào?'} maxLength={2000} aria-label="Nội dung tin nhắn" /><button type="submit" aria-label="Gửi tin nhắn" disabled={loading || !input.trim()}><SendOutlined /></button></form>
      <p className="chat-footnote">Hãy kiểm tra thông tin ca trước khi ứng tuyển.</p>
    </section>}
  </div>;
}
