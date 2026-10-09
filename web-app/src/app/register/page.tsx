'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const [role, setRole] = useState('STUDENT');
  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Nếu là sinh viên, coi identifier là username (MSSV). Nếu doanh nghiệp, coi là email.
    const isStudent = role === 'STUDENT';
    const payload = {
      role,
      password,
      username: isStudent ? identifier : null,
      email: !isStudent ? identifier : null,
      full_name: isStudent ? name : null,
      company_name: !isStudent ? name : null
    };

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        let errorMsg = 'Đăng ký thất bại';
        if (data.detail) {
          errorMsg = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
        }
        throw new Error(errorMsg);
      }

      alert('Đăng ký thành công! Hãy đăng nhập.');
      router.push('/login');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Đã xảy ra lỗi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-3xl shadow-xl p-8 border border-gray-100 dark:border-gray-800">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary">Tạo tài khoản</h1>
          <p className="text-sm text-gray-500 mt-2">Bắt đầu trải nghiệm EduShift</p>
        </div>

        <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl mb-6">
          <button
            type="button"
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${role === 'STUDENT' ? 'bg-white dark:bg-gray-700 shadow-sm text-primary' : 'text-gray-500'}`}
            onClick={() => { setRole('STUDENT'); setIdentifier(''); setName(''); }}
          >
            Sinh Viên
          </button>
          <button
            type="button"
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${role === 'EMPLOYER' ? 'bg-white dark:bg-gray-700 shadow-sm text-primary' : 'text-gray-500'}`}
            onClick={() => { setRole('EMPLOYER'); setIdentifier(''); setName(''); }}
          >
            Doanh Nghiệp
          </button>
        </div>

        {error && (
          <div className="bg-red-50 text-red-500 p-3 rounded-xl text-sm mb-5 border border-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              {role === 'STUDENT' ? 'Họ và tên' : 'Tên doanh nghiệp'}
            </label>
            <input
              type="text"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all dark:bg-gray-800 dark:border-gray-700"
              placeholder={role === 'STUDENT' ? 'Nguyễn Văn A' : 'Công ty TNHH EduShift'}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              {role === 'STUDENT' ? 'Tên đăng nhập (MSSV)' : 'Email liên hệ'}
            </label>
            <input
              type={role === 'STUDENT' ? 'text' : 'email'}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all dark:bg-gray-800 dark:border-gray-700"
              placeholder={role === 'STUDENT' ? 'VD: Mã sinh viên' : 'email@example.com'}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Mật khẩu</label>
            <input
              type="password"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all dark:bg-gray-800 dark:border-gray-700"
              placeholder="Tạo mật khẩu"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-secondary hover:bg-opacity-90 disabled:opacity-50 text-white font-semibold py-3 rounded-xl shadow-lg shadow-secondary/30 transition-all hover:-translate-y-0.5 mt-2"
          >
            {loading ? 'Đang xử lý...' : 'Đăng ký ngay'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Đã có tài khoản?{' '}
          <Link href="/login" className="text-primary font-semibold hover:underline">
            Đăng nhập
          </Link>
        </p>
      </div>
    </div>
  );
}
