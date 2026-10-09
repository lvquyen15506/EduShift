import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { api, ApiError } from './api';
import { registerPushToken, removePushToken } from './push';

const STORAGE_KEY = 'edushift.student.session';

type Session = { access_token: string; role: 'STUDENT'; user_id: string; username?: string };
type LoginResponse = { access_token: string; role: string; user_id: string; username?: string };
type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  signIn: (identifier: string, password: string) => Promise<void>;
  signUp: (fullName: string, username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync(STORAGE_KEY);
        if (!stored) return;
        const candidate = JSON.parse(stored) as Session;
        if (!candidate.access_token || candidate.role !== 'STUDENT') {
          await SecureStore.deleteItemAsync(STORAGE_KEY);
          return;
        }
        try {
          const me = await api<{ role: string }>('/api/auth/me', { token: candidate.access_token });
          if (me.role !== 'STUDENT') throw new ApiError('Phiên đăng nhập không hợp lệ', 401);
        } catch (error) {
          if (error instanceof ApiError && error.status === 401) {
            await SecureStore.deleteItemAsync(STORAGE_KEY);
            return;
          }
        }
        if (active) setSession(candidate);
      } catch {
        await SecureStore.deleteItemAsync(STORAGE_KEY).catch(() => {});
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const persist = useCallback(async (data: LoginResponse, username?: string) => {
    if (data.role !== 'STUDENT') throw new Error('Ứng dụng này dành cho tài khoản sinh viên.');
    const next: Session = { access_token: data.access_token, role: 'STUDENT', user_id: data.user_id, username: data.username || username };
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(next));
    setSession(next);
  }, []);

  const signIn = useCallback(async (identifier: string, password: string) => {
    const data = await api<LoginResponse>('/api/auth/login', { method: 'POST', body: { identifier, password } });
    await persist(data, identifier);
  }, [persist]);

  const signUp = useCallback(async (fullName: string, username: string, password: string) => {
    const data = await api<LoginResponse>('/api/auth/register', { method: 'POST', body: { role: 'STUDENT', full_name: fullName, username, password } });
    await persist(data, username);
  }, [persist]);

  const signOut = useCallback(async () => {
    if (session) await removePushToken(session.access_token).catch(() => {});
    await SecureStore.deleteItemAsync(STORAGE_KEY);
    setSession(null);
  }, [session]);

  useEffect(() => {
    if (session) void registerPushToken(session.access_token).catch(() => {});
  }, [session]);

  const value = useMemo(() => ({ session, loading, signIn, signUp, signOut }), [session, loading, signIn, signUp, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useSession() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useSession must be used inside AuthProvider');
  return context;
}
