'use client';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { CloseOutlined, MessageOutlined, RobotOutlined, SendOutlined } from '@ant-design/icons';
import { api } from '@/lib/api';

type ChatMessage = { role: 'user' | 'assistant'; content: string };
type ChatResponse = { answer: string };

export default function ChatWidget({ support = false }: { support?: boolean }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [authenticated, setAuthenticated] = useState(support);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const refresh = () => {
      try { setAuthenticated(support || Boolean(JSON.parse(localStorage.getItem('user') || '{}').access_token)); }
      catch { setAuthenticated(support); }
    };
    window.addEventListener('edushift-account-updated', refresh);
    window.addEventListener('storage', refresh);
    const timer = window.setTimeout(refresh, 0);
    return () => { window.clearTimeout(timer); window.removeEventListener('edushift-account-updated', refresh); window.removeEventListener('storage', refresh); };
  }, [support]);
  useEffect(() => { if (open) bottomRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }); }, [messages, loading, open]);
  const welcome = authenticated ? 'Chào bạn! Mình có thể hỗ trợ tài khoản, lịch học, tìm ca và ứng tuyển. Bạn cần giúp gì?' : 'Chào bạn! Mình có thể giúp bạn khám phá EduShift và tìm những ca đang tuyển.';
  const openChat = () => { if (!messages.length) setMessages([{ role: 'assistant', content: welcome }]); setOpen(true); };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const message = input.trim();
    if (!message || loading) return;
    const next: ChatMessage[] = [...messages, { role: 'user', content: message }];
    setMessages(next); setInput(''); setLoading(true);
    try {
      const result = await api<ChatResponse>('/api/chat', { method: 'POST', body: JSON.stringify({ message, history: next.slice(-8) }) });
      setMessages(current => [...current, { role: 'assistant', content: result.answer }]);
    } catch {
      setMessages(current => [...current, { role: 'assistant', content: 'Mình chưa kết nối được máy chủ. Bạn thử lại sau ít phút nhé.' }]);
    } finally { setLoading(false); }
  };
  return <div className="chat-widget">
    {!open && <button className="chat-launcher" type="button" aria-label="Mở trợ lý EduShift" onClick={openChat}><MessageOutlined /><span>Trợ lý EduShift</span></button>}
    {open && <section className="chat-panel" aria-label="Trợ lý EduShift">
      <header className="chat-panel-head"><div className="chat-panel-identity"><span className="chat-avatar"><RobotOutlined /></span><span><b>{authenticated ? 'Hỗ trợ EduShift' : 'Tư vấn EduShift'}</b><small><i /> Sẵn sàng hỗ trợ bạn</small></span></div><button className="chat-close" type="button" aria-label="Đóng trợ lý" onClick={() => setOpen(false)}><CloseOutlined /></button></header>
      <div className="chat-messages" role="log" aria-live="polite" aria-relevant="additions text">
        {messages.map((item, index) => <div className={'chat-message ' + item.role} key={index}>{item.role === 'assistant' && <span className="chat-message-avatar"><RobotOutlined /></span>}<p>{item.content}</p></div>)}
        {loading && <div className="chat-message assistant chat-pending" role="status" aria-label="Trợ lý đang trả lời"><span className="chat-message-avatar"><RobotOutlined /></span><p><span className="chat-typing"><i /><i /><i /></span><span className="chat-pending-label">Đang soạn câu trả lời...</span></p></div>}
        <div ref={bottomRef} />
      </div>
      <form className="chat-compose" onSubmit={submit}><input value={input} onChange={event => setInput(event.target.value)} placeholder={authenticated ? 'Bạn cần hỗ trợ điều gì?' : 'Bạn muốn tìm công việc nào?'} maxLength={2000} aria-label="Nội dung tin nhắn" /><button type="submit" aria-label="Gửi tin nhắn" disabled={loading || !input.trim()}><SendOutlined /></button></form>
      <p className="chat-footnote">Hãy kiểm tra thông tin ca trước khi ứng tuyển.</p>
    </section>}
  </div>;
}
