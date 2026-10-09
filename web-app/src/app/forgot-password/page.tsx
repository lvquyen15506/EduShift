'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import styles from '../register/register.module.css';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [stage, setStage] = useState<'request' | 'confirm' | 'done'>('request');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);

  async function post(path: string, body: unknown) {
    const response = await fetch((process.env.NEXT_PUBLIC_API_URL || '') + path, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'Không thể thực hiện yêu cầu');
  }

  async function requestCode(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault(); setError(''); setNotice(''); setLoading(true);
    try {
      await post('/api/auth/password-reset/request', { email: email.trim().toLowerCase() });
      setStage('confirm');
      setNotice('Nếu email đã có tài khoản, mã OTP đã được gửi. Mã có hiệu lực trong 10 phút.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Đã xảy ra lỗi'); }
    finally { setLoading(false); }
  }

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setLoading(true);
    try {
      await post('/api/auth/password-reset/confirm', { email: email.trim().toLowerCase(), code, new_password: password });
      setStage('done'); setNotice('Đã đổi mật khẩu. Bạn có thể đăng nhập.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Mã OTP không hợp lệ'); }
    finally { setLoading(false); }
  }

  return <main className="auth-page"><section className={styles.card} aria-labelledby="reset-title">
    <Link href="/" className={styles.brand}><span className="mark">E</span><span className="brand-name">Edu<span>Shift</span></span></Link>
    <header className={styles.header}><span className={styles.eyebrow}>BẢO MẬT TÀI KHOẢN</span><h1 id="reset-title">Quên mật khẩu</h1>
      <p>{stage === 'request' ? 'Nhập email đã đăng ký để nhận mã xác nhận.' : stage === 'confirm' ? `Nhập mã đã gửi đến ${email}.` : 'Mật khẩu của bạn đã được cập nhật.'}</p></header>
    {notice && <div className={styles.notice} role="status">{notice}</div>}
    {error && <div className={styles.error} role="alert">{error}</div>}
    {stage !== 'done' && <form className={styles.form} onSubmit={stage === 'request' ? requestCode : confirm}>
      {stage === 'request' ? <div className={styles.field}><label htmlFor="reset-email">Email</label><input id="reset-email" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required /></div> : <>
        <div className={styles.field}><label htmlFor="reset-code">Mã OTP</label><input id="reset-code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ''))} required /></div>
        <div className={styles.field}><label htmlFor="reset-password">Mật khẩu mới</label><input id="reset-password" type="password" autoComplete="new-password" minLength={6} value={password} onChange={event => setPassword(event.target.value)} required /></div>
      </>}
      <button className={styles.submit} type="submit" disabled={loading}>{loading ? 'Đang xử lý...' : stage === 'request' ? 'Gửi mã xác nhận' : 'Đổi mật khẩu'}</button>
      {stage === 'confirm' && <div className={styles.otpActions}><button type="button" className={styles.textButton} disabled={loading} onClick={() => { setStage('request'); setError(''); setNotice(''); }}>Sửa email</button><button type="button" className={styles.textButton} disabled={loading} onClick={() => { void requestCode(); }}>Gửi lại mã</button></div>}
    </form>}
    <p className={styles.footer}><Link href="/login">Quay lại đăng nhập</Link></p>
  </section></main>;
}
