'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert, Button, Card, Form, Input, Typography } from 'antd';
import { LockOutlined, LoginOutlined, MailOutlined } from '@ant-design/icons';

type LoginValues = { identifier: string; password: string };
export default function LoginPage() {
  const [error, setError] = useState(''); const [loading, setLoading] = useState(false); const router = useRouter();
  const handleLogin = async (values: LoginValues) => {
    setError(''); setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
      const data = await res.json(); if (!res.ok) throw new Error(data.detail || 'Đăng nhập thất bại');
      localStorage.setItem('user', JSON.stringify(data));
      const next = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('next') : null; const home = data.role === 'ADMIN' ? '/admin' : data.role === 'STUDENT' ? '/student' : '/dashboard'; router.replace(next && (data.role === 'ADMIN' ? next.startsWith('/admin') : data.role === 'STUDENT' ? ['/student', '/shifts', '/notifications'].some((path: string) => next.startsWith(path)) : ['/dashboard', '/shifts', '/candidates', '/notifications'].some((path: string) => next.startsWith(path))) ? next : home);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Đã xảy ra lỗi'); } finally { setLoading(false); }
  };
  return <main className="auth-page"><Card className="auth-card" variant="borderless"><Link href="/" className="auth-brand"><span className="mark">E</span><span className="brand-name">Edu<span>Shift</span></span></Link><Typography.Title level={2}>Chào mừng trở lại</Typography.Title><Typography.Paragraph className="auth-subtitle">Đăng nhập để kết nối công việc phù hợp với lịch học.</Typography.Paragraph>{error && <Alert type="error" showIcon title={error} className="auth-alert" />}<Form<LoginValues> layout="vertical" requiredMark={false} onFinish={handleLogin} size="large"><Form.Item label="Email hoặc tên đăng nhập" name="identifier" rules={[{ required: true, message: 'Vui lòng nhập email hoặc tên đăng nhập' }]}><Input prefix={<MailOutlined />} placeholder="Email hoặc MSSV" autoComplete="username" /></Form.Item><Form.Item label="Mật khẩu" name="password" rules={[{ required: true, message: 'Vui lòng nhập mật khẩu' }]}><Input.Password prefix={<LockOutlined />} placeholder="Nhập mật khẩu" autoComplete="current-password" /></Form.Item><Button type="primary" htmlType="submit" block loading={loading} icon={<LoginOutlined />}>{loading ? 'Đang đăng nhập...' : 'Đăng nhập'}</Button></Form><p className="auth-footer">Chưa có tài khoản? <Link href="/register">Đăng ký ngay</Link></p></Card></main>;
}
