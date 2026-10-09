'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import OtpCodeInput from '@/components/OtpCodeInput';
import styles from './register.module.css';

type Role = 'STUDENT' | 'EMPLOYER';

export default function RegisterPage() {
  const [role, setRole] = useState<Role>('STUDENT');
  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'details' | 'verify' | 'success'>('details');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const isStudent = role === 'STUDENT';

  const changeRole = (nextRole: Role) => {
    setRole(nextRole);
    setIdentifier('');
    setName('');
    setEmail('');
    setPassword('');
    setStage('details');
    setCode('');
    setError('');
    setNotice('');
  };

  const post = async (path: string, body: unknown) => {
    const res = await fetch((process.env.NEXT_PUBLIC_API_URL || '') + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'Không thể thực hiện yêu cầu');
    return data;
  };

  const requestCode = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);
    try {
      await post('/api/auth/register', {
        role,
        password,
        username: isStudent ? identifier.trim() : null,
        email: email.trim().toLowerCase(),
        full_name: isStudent ? name.trim() : null,
        company_name: isStudent ? null : name.trim(),
      });
      setStage('verify');
      setCode('');
      setNotice('Mã OTP đã được gửi đến email. Mã có hiệu lực trong 10 phút.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Đã xảy ra lỗi');
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await post('/api/auth/register/verify', { email: email.trim().toLowerCase(), code: code.trim() });
      setStage('success');
      setNotice('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Mã OTP không hợp lệ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <section className={styles.card} aria-labelledby="register-title">
        <Link href="/" className={styles.brand} aria-label="Về trang chủ EduShift">
          <span className="mark">E</span>
          <span className="brand-name">Edu<span>Shift</span></span>
        </Link>

        <header className={styles.header}>
          <span className={styles.eyebrow}>THAM GIA EDUSHIFT</span>
          <h1 id="register-title">{stage === 'details' ? 'Tạo tài khoản' : stage === 'verify' ? 'Xác nhận email' : 'Tài khoản đã sẵn sàng'}</h1>
          <p>{stage === 'details'
            ? 'Bắt đầu tìm ca làm phù hợp với lịch học của bạn.'
            : stage === 'verify' ? 'Nhập mã 6 số đã gửi tới ' + email + '.' : 'Email của bạn đã được xác nhận thành công.'}</p>
        </header>

        {stage === 'details' && <div className={styles.roleSwitch} role="group" aria-label="Loại tài khoản">
          <button
            type="button"
            className={styles.roleButton + (isStudent ? ' ' + styles.roleActive : '')}
            aria-pressed={isStudent}
            onClick={() => changeRole('STUDENT')}
          >
            Sinh viên
          </button>
          <button
            type="button"
            className={styles.roleButton + (!isStudent ? ' ' + styles.roleActive : '')}
            aria-pressed={!isStudent}
            onClick={() => changeRole('EMPLOYER')}
          >
            Doanh nghiệp
          </button>
        </div>}

        {notice && <div className={styles.notice} role="status">{notice}</div>}
        {error && <div className={styles.error} role="alert">{error}</div>}

        {stage === 'success' ? <div className={styles.successPanel} role="status">
          <span className={styles.successIcon} aria-hidden="true">✓</span>
          <h2>Đăng ký thành công</h2>
          <p>{isStudent
            ? 'Bạn có thể đăng nhập và bắt đầu tìm ca làm phù hợp với lịch học.'
            : 'Bạn có thể đăng nhập. Tài khoản doanh nghiệp cần được quản trị viên duyệt trước khi đăng ca.'}</p>
          <Link className={styles.successLink} href="/login">Đi đến đăng nhập</Link>
        </div> : <form className={styles.form} onSubmit={stage === 'details' ? requestCode : verifyCode}>
          {stage === 'details' ? <>
          <div className={styles.field}>
            <label htmlFor="register-name">{isStudent ? 'Họ và tên' : 'Tên doanh nghiệp'}</label>
            <input
              id="register-name"
              type="text"
              autoComplete={isStudent ? 'name' : 'organization'}
              placeholder={isStudent ? 'Nguyễn Văn A' : 'Công ty TNHH EduShift'}
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </div>
          {isStudent && <div className={styles.field}>
            <label htmlFor="register-identifier">Tên đăng nhập (MSSV)</label>
            <input
              id="register-identifier"
              type="text"
              autoComplete="username"
              placeholder="Ví dụ: 261800009"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              required
            />
          </div>}
          <div className={styles.field}>
            <label htmlFor="register-email">Email nhận mã OTP</label>
            <input id="register-email" type="email" autoComplete="email" placeholder="ban@example.com"
              value={email} onChange={(event) => setEmail(event.target.value)} required />
          </div>
          <div className={styles.field}>
            <label htmlFor="register-password">Mật khẩu</label>
            <input
              id="register-password"
              type="password"
              autoComplete="new-password"
              minLength={6}
              placeholder="Ít nhất 6 ký tự"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          </> : <OtpCodeInput id="register-code" value={code} onChange={setCode} disabled={loading} />}
          <button className={styles.submit} type="submit" disabled={loading}>
            {loading ? 'Đang xử lý...' : stage === 'details' ? 'Gửi mã xác nhận' : 'Xác nhận và tạo tài khoản'}
          </button>
          {stage === 'verify' && <div className={styles.otpActions}>
            <button type="button" className={styles.textButton} disabled={loading}
              onClick={() => { setStage('details'); setCode(''); setError(''); setNotice(''); }}>Sửa thông tin</button>
            <button type="button" className={styles.textButton} disabled={loading}
              onClick={() => { void requestCode(); }}>Gửi lại mã</button>
          </div>}
        </form>}

        {stage !== 'success' && <p className={styles.footer}>Đã có tài khoản? <Link href="/login">Đăng nhập</Link></p>}
      </section>
    </main>
  );
}
