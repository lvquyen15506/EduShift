'use client';

import { useEffect, useState } from 'react';
import { Alert, Button, Card, message, Skeleton, Table, Tag } from 'antd';
import AppShell from '@/components/AppShell';
import { api } from '@/lib/api';

type User = {
  id: string;
  name: string;
  username: string | null;
  email: string | null;
  role: string;
  created_at: string;
  is_verified: boolean | null;
};

export default function AdminUsers() {
  const [rows, setRows] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    api<User[]>('/api/admin/users').then(setRows).catch(cause => setError(cause.message)).finally(() => setLoading(false));
  }, []);

  async function toggleVerification(row: User) {
    if (busy || row.role !== 'EMPLOYER') return;
    setBusy(row.id);
    try {
      const result = await api<{ is_verified: boolean }>('/api/admin/employers/' + encodeURIComponent(row.id) + '/verify', {
        method: 'PATCH',
        body: JSON.stringify({ is_verified: !row.is_verified }),
      });
      setRows(current => current.map(item => item.id === row.id ? { ...item, is_verified: result.is_verified } : item));
      messageApi.success(result.is_verified ? 'Đã xác minh doanh nghiệp' : 'Đã thu hồi xác minh');
    } catch (cause) {
      messageApi.error(cause instanceof Error ? cause.message : 'Không thể đổi trạng thái xác minh');
    } finally {
      setBusy(null);
    }
  }

  return <AppShell>{contextHolder}<div className="role-page admin-page">
    <div className="role-heading"><div><span className="eyebrow">QUẢN TRỊ / TÀI KHOẢN</span><h1>Tài khoản hệ thống</h1><p>Xác minh doanh nghiệp trước khi họ đăng ca mới.</p></div></div>
    {error && <Alert type="error" title={error} />}
    {loading ? <Skeleton active /> : <Card className="admin-table-card"><Table rowKey="id" dataSource={rows} columns={[
      { title: 'Tên', dataIndex: 'name' },
      { title: 'Username', dataIndex: 'username' },
      { title: 'Email', dataIndex: 'email' },
      { title: 'Vai trò', dataIndex: 'role', render: (role: string) => <Tag color={role === 'ADMIN' ? 'purple' : role === 'STUDENT' ? 'green' : 'magenta'}>{role}</Tag> },
      { title: 'Xác minh', dataIndex: 'is_verified', render: (verified: boolean | null) => verified === null ? '—' : <Tag color={verified ? 'green' : 'orange'}>{verified ? 'Đã xác minh' : 'Chờ duyệt'}</Tag> },
      { title: 'Thao tác', render: (_: unknown, row: User) => row.role === 'EMPLOYER' ? <Button loading={busy === row.id} disabled={Boolean(busy)} onClick={() => void toggleVerification(row)}>{row.is_verified ? 'Thu hồi' : 'Xác minh'}</Button> : null },
    ]} /></Card>}
  </div></AppShell>;
}
