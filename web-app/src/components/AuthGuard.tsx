'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Alert, Button, Spin } from 'antd';
import { API_URL } from '@/lib/api';

type Role = 'STUDENT' | 'EMPLOYER' | 'ADMIN';
const home: Record<Role, string> = { STUDENT: '/student', EMPLOYER: '/dashboard', ADMIN: '/admin' };
const publicPaths = ['/', '/login', '/register', '/forgot-password', '/pricing', '/support', '/terms', '/privacy'];
function allowed(path: string, role: Role) {
  if (path === '/profile') return true;
  if (path.startsWith('/admin')) return role === 'ADMIN';
  if (path.startsWith('/student')) return role === 'STUDENT';
  if (path.startsWith('/dashboard') || path.startsWith('/candidates') || path.startsWith('/shifts/new')) return role === 'EMPLOYER';
  if (path.startsWith('/student/shifts')) return role === 'STUDENT';
  if (path.startsWith('/shifts')) return role === 'EMPLOYER';
  if (path.startsWith('/notifications')) return true;
  return false;
}
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [state, setState] = useState<{ path: string; status: 'ready' | 'error' } | null>(null);
  useEffect(() => {
    if (publicPaths.includes(pathname)) return;
    const controller = new AbortController();
    const validate = async () => {
      let token = '';
      try { token = JSON.parse(localStorage.getItem('user') || '{}').access_token || ''; } catch { localStorage.removeItem('user'); }
      if (!token) { router.replace('/login?next=' + encodeURIComponent(pathname)); return; }
      try {
        const response = await fetch(API_URL + '/api/auth/me', { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store', signal: controller.signal });
        if (response.status === 401 || response.status === 403) { localStorage.removeItem('user'); router.replace('/login?next=' + encodeURIComponent(pathname)); return; }
        if (!response.ok) throw new Error('Không thể xác thực phiên đăng nhập');
        const me = await response.json();
        const role = me.role as Role;
        if (!home[role]) { localStorage.removeItem('user'); router.replace('/login'); return; }
        const stored = JSON.parse(localStorage.getItem('user') || '{}');
        localStorage.setItem('user', JSON.stringify({ ...stored, role, profile: me.profile, username: me.username, email: me.email, avatar_data: me.avatar_data }));
        if (!allowed(pathname, role)) { router.replace(home[role]); return; }
        setState({ path: pathname, status: 'ready' });
      } catch {
        if (!controller.signal.aborted) setState({ path: pathname, status: 'error' });
      }
    };
    validate();
    return () => controller.abort();
  }, [pathname, router]);
  if (publicPaths.includes(pathname)) return <>{children}</>;
  if (state?.path === pathname && state.status === 'error') return <div className="auth-loading"><Alert type="error" title="Không thể kết nối máy chủ" description="Vui lòng thử lại sau khi kiểm tra Docker Compose." action={<Button onClick={() => window.location.reload()}>Thử lại</Button>} /></div>;
  if (state?.path !== pathname || state.status !== 'ready') return <div className="auth-loading"><Spin description="Đang xác thực..." /></div>;
  return <>{children}</>;
}
