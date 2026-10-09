'use client';

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Alert, Avatar, Button, Card, Skeleton } from 'antd';
import { CameraOutlined, DeleteOutlined, SaveOutlined } from '@ant-design/icons';
import AppShell from '@/components/AppShell';
import { api } from '@/lib/api';

type Role = 'STUDENT' | 'EMPLOYER' | 'ADMIN';
type Account = {
  id: string; role: Role; username: string | null; email: string | null; avatar_data: string | null;
  profile: { full_name?: string; company_name?: string; phone?: string; university?: string; major?: string; skills?: string; address?: string } | null;
};
const roleFields: Record<Role, { key: string; label: string; max: number; required?: boolean }[]> = {
  STUDENT: [
    { key: 'full_name', label: 'Họ và tên', max: 150, required: true },
    { key: 'phone', label: 'Số điện thoại', max: 30 },
    { key: 'university', label: 'Trường học', max: 200 },
    { key: 'major', label: 'Ngành học', max: 200 },
    { key: 'skills', label: 'Kỹ năng', max: 1000 },
  ],
  EMPLOYER: [
    { key: 'company_name', label: 'Tên doanh nghiệp', max: 200, required: true },
    { key: 'phone', label: 'Số điện thoại', max: 30 },
    { key: 'address', label: 'Địa chỉ', max: 300 },
  ],
  ADMIN: [],
};
function remember(account: Account) {
  let stored = {};
  try { stored = JSON.parse(localStorage.getItem('user') || '{}'); } catch { /* Replace damaged cache. */ }
  localStorage.setItem('user', JSON.stringify({ ...stored, ...account }));
  window.dispatchEvent(new Event('edushift-account-updated'));
}
async function cropAvatar(file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Chọn ảnh JPG, PNG hoặc WebP.');
  if (file.size > 8_000_000) throw new Error('Ảnh gốc cần nhỏ hơn 8 MB.');
  const image = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 320;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Trình duyệt không thể xử lý ảnh này.');
    const side = Math.min(image.width, image.height);
    context.fillStyle = '#fff';
    context.fillRect(0, 0, 320, 320);
    context.drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, 320, 320);
    return canvas.toDataURL('image/jpeg', 0.84);
  } finally { image.close(); }
}

export default function ProfilePage() {
  const [account, setAccount] = useState<Account | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api<Account>('/api/auth/me').then(data => {
      setAccount(data);
      const values: Record<string, string> = { username: data.username || '', email: data.email || '' };
      for (const field of roleFields[data.role]) {
        const value = data.profile?.[field.key as keyof NonNullable<Account['profile']>];
        values[field.key] = value || '';
      }
      setFields(values);
    }).catch(cause => setError(cause instanceof Error ? cause.message : 'Không tải được hồ sơ.')).finally(() => setLoading(false));
  }, []);

  const saved = (data: Account, message: string) => {
    setAccount(data); remember(data); setError(''); setSuccess(message);
  };
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!account) return;
    setSaving(true); setError(''); setSuccess('');
    const payload: Record<string, string | null> = {
      username: fields.username?.trim() || null,
      email: fields.email?.trim() || null,
    };
    for (const field of roleFields[account.role]) payload[field.key] = fields[field.key]?.trim() || '';
    try {
      saved(await api<Account>('/api/auth/profile', { method: 'PATCH', body: JSON.stringify(payload) }), 'Thông tin cá nhân đã được lưu.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không lưu được thông tin.'); }
    finally { setSaving(false); }
  };
  const changeAvatar = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setAvatarSaving(true); setError(''); setSuccess('');
    try {
      const avatar_data = await cropAvatar(file);
      saved(await api<Account>('/api/auth/avatar', { method: 'PATCH', body: JSON.stringify({ avatar_data }) }), 'Ảnh đại diện đã được cập nhật.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không cập nhật được ảnh đại diện.'); }
    finally { setAvatarSaving(false); }
  };
  const removeAvatar = async () => {
    setAvatarSaving(true); setError(''); setSuccess('');
    try {
      saved(await api<Account>('/api/auth/avatar', { method: 'PATCH', body: JSON.stringify({ avatar_data: null }) }), 'Đã xóa ảnh đại diện.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không xóa được ảnh đại diện.'); }
    finally { setAvatarSaving(false); }
  };
  const name = account?.profile?.full_name || account?.profile?.company_name || account?.username || account?.email || 'Tài khoản';
  const initials = name.trim().split(/\s+/).map(part => part[0]).join('').slice(-2).toUpperCase();
  const roleLabel = account?.role === 'STUDENT' ? 'Sinh viên' : account?.role === 'EMPLOYER' ? 'Doanh nghiệp' : 'Quản trị viên';

  return <AppShell><div className="profile-page">
    <div className="page-heading"><div><span className="eyebrow">TÀI KHOẢN / HỒ SƠ</span><h1>Hồ sơ cá nhân</h1><p>Cập nhật thông tin và ảnh đại diện của bạn.</p></div></div>
    {error && <Alert type="error" showIcon title={error} className="profile-alert" />}
    {success && <Alert type="success" showIcon title={success} className="profile-alert" />}
    {loading ? <Skeleton active /> : account && <div className="profile-grid">
      <Card className="profile-avatar-card">
        <div className="profile-avatar-banner" aria-hidden="true">✦</div>
        <Avatar size={112} src={account.avatar_data || undefined} className="profile-avatar">{initials}</Avatar>
        <h2>{name}</h2><p className="profile-role">{roleLabel}</p>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={changeAvatar} className="profile-file-input" aria-label="Chọn ảnh đại diện" />
        <Button icon={<CameraOutlined />} loading={avatarSaving} onClick={() => fileRef.current?.click()}>Đổi ảnh đại diện</Button>
        {account.avatar_data && <Button type="text" danger icon={<DeleteOutlined />} disabled={avatarSaving} onClick={removeAvatar}>Xóa ảnh</Button>}
        <small>Ảnh JPG, PNG hoặc WebP. Ảnh sẽ được cắt vuông trước khi lưu.</small>
      </Card>
      <Card className="profile-form-card">
        <form onSubmit={save}>
          <h2>Thông tin tài khoản</h2>
          <div className="profile-form-row">
            <label>Tên đăng nhập<input value={fields.username || ''} maxLength={80} onChange={event => setFields({ ...fields, username: event.target.value })} /></label>
            <label>Email<input type="email" value={fields.email || ''} onChange={event => setFields({ ...fields, email: event.target.value })} /></label>
          </div>
          {roleFields[account.role].length > 0 && <h2>{account.role === 'STUDENT' ? 'Thông tin sinh viên' : 'Thông tin doanh nghiệp'}</h2>}
          <div className="profile-form-row">{roleFields[account.role].map(field => <label key={field.key}>{field.label}<input value={fields[field.key] || ''} maxLength={field.max} required={field.required} onChange={event => setFields({ ...fields, [field.key]: event.target.value })} /></label>)}</div>
          <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving}>Lưu thay đổi</Button>
        </form>
      </Card>
    </div>}
  </div></AppShell>;
}
