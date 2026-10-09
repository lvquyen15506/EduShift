export const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
export function authHeaders(): HeadersInit {
  if (typeof window === 'undefined') return {};
  const user = localStorage.getItem('user');
  try { const token = user ? JSON.parse(user).access_token : ''; return token ? { Authorization: `Bearer ${token}` } : {}; } catch { return {}; }
}
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(init.headers || {}) }, cache: 'no-store' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'Không thể tải dữ liệu');
  return data as T;
}
