'use client';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { MessageOutlined, SendOutlined, CloseOutlined, RobotOutlined } from '@ant-design/icons';
import { api } from '@/lib/api';

type ChatMessage = { role: 'user' | 'assistant'; content: string };
type ChatSource = { type: string; id?: string; title?: string; company_name?: string; location?: string };
type ChatResponse = { answer: string; mode: 'gemini' | 'local'; authenticated: boolean; sources: ChatSource[] };

export default function ChatWidget({ support = false }: { support?: boolean }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [authenticated, setAuthenticated] = useState(support);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  useEffect(() => { const onAccount = () => { let loggedIn = support; try { loggedIn = Boolean(JSON.parse(localStorage.getItem('user') || '{}').access_token) || support; } catch { /* anonymous */ } setAuthenticated(loggedIn); }; window.addEventListener('edushift-account-updated', onAccount); window.addEventListener('storage', onAccount); const timer = window.setTimeout(onAccount, 0); return () => { window.clearTimeout(timer); window.removeEventListener('edushift-account-updated', onAccount); window.removeEventListener('storage', onAccount); }; }, [support]);
  const welcome = useMemo(() => authenticated ? 'Chào bạn! Mình có thể hỗ trợ tài khoản, lịch học, tìm ca, ứng tuyển và nhận ca. Bạn cần giúp gì?' : 'Chào bạn! Mình có thể tư vấn cách tìm việc trên EduShift và các ca đang tuyển phù hợp.', [authenticated]);
  const openChat = () => { setOpen(true); if (!messages.length) setMessages([{ role: 'assistant', content: welcome }]); };
  const submit = async (event: FormEvent) => { event.preventDefault(); const message = input.trim(); if (!message || loading) return; const next = [...messages, { role: 'user' as const, content: message }]; setMessages(next); setInput(''); setLoading(true); try { const result = await api<ChatResponse>('/api/chat', { method: 'POST', body: JSON.stringify({ message, history: next.slice(-8) }) }); setMessages(current => [...current, { role: 'assistant', content: result.answer }]); } catch { setMessages(current => [...current, { role: 'assistant', content: 'Mình chưa kết nối được máy chủ. Bạn thử lại sau ít phút nhé.' }]); } finally { setLoading(false); } };
  return <div className="chat-widget"><button className={'chat-launcher ' + (open ? 'is-open' : '')} type="button" aria-label={open ? 'Đóng trợ lý' : 'Mở trợ lý EduShift'} onClick={() => open ? setOpen(false) : openChat()}>{open ? <CloseOutlined /> : <MessageOutlined />}<span>{open ? '' : 'Trợ lý EduShift'}</span></button>{open && <section className="chat-panel" aria-label="Trợ lý EduShift"><header className="chat-panel-head"><div><span className="chat-avatar"><RobotOutlined /></span><span><b>{authenticated ? 'Hỗ trợ EduShift' : 'Tư vấn EduShift'}</b><small>{authenticated ? 'Đang hỗ trợ tài khoản' : 'Tư vấn ca làm và nền tảng'}</small></span></div><button type="button" aria-label="Đóng" onClick={() => setOpen(false)}><CloseOutlined /></button></header><div className="chat-messages">{messages.map((item, index) => <div className={'chat-message ' + item.role} key={item.role + index}><p>{item.content}</p></div>)}{loading && <div className="chat-message assistant"><p className="chat-typing"><i /><i /><i /></p></div>}</div><form className="chat-compose" onSubmit={submit}><input value={input} onChange={event => setInput(event.target.value)} placeholder={authenticated ? 'Bạn cần hỗ trợ điều gì?' : 'Bạn muốn tìm công việc nào?'} maxLength={2000} aria-label="Nội dung tin nhắn" /><button type="submit" aria-label="Gửi" disabled={loading || !input.trim()}><SendOutlined /></button></form></section>}</div>;
}
