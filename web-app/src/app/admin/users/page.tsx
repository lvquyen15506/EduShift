'use client';
import { useEffect, useState } from 'react';
import { Alert, Button, Card, Form, Input, Modal, Select, Skeleton, Space, Switch, Table, Tag, message } from 'antd';
import AppShell from '@/components/AppShell';
import { api } from '@/lib/api';

type User = { id: string; name: string; username: string | null; email: string | null; role: string; created_at: string; is_verified: boolean | null; is_active: boolean; deleted_at: string | null };
export default function AdminUsers() {
  const [rows, setRows] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('');
  const [editing, setEditing] = useState<User | null>(null);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const [msg, holder] = message.useMessage();
  useEffect(() => { api<User[]>('/api/admin/users').then(setRows).catch(e => setError(e.message)).finally(() => setLoading(false)); }, []);
  async function refresh() {
    try { setRows(await api<User[]>('/api/admin/users?' + new URLSearchParams({ q: query, role }).toString())); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Không thể tải tài khoản'); }
  }
  function show(row: User | null) { setEditing(row); form.resetFields(); form.setFieldsValue(row ? { ...row, password: undefined } : { role: 'STUDENT', is_active: true }); setOpen(true); }
  async function save() {
    let values: Record<string, unknown>;
    try { values = await form.validateFields(); } catch { return; }
    setBusy('form');
    try {
      await api(editing ? '/api/admin/users/' + editing.id : '/api/admin/users', { method: editing ? 'PATCH' : 'POST', body: JSON.stringify(values) });
      setOpen(false); await refresh(); msg.success('Đã lưu tài khoản');
    } catch (e) { msg.error(e instanceof Error ? e.message : 'Không thể lưu tài khoản'); }
    finally { setBusy(null); }
  }
  async function action(row: User, kind: 'verify' | 'active' | 'delete') {
    setBusy(row.id);
    try {
      if (kind === 'verify') await api('/api/admin/employers/' + row.id + '/verify', { method: 'PATCH', body: JSON.stringify({ is_verified: !row.is_verified }) });
      else if (kind === 'active') await api('/api/admin/users/' + row.id, { method: 'PATCH', body: JSON.stringify({ is_active: !row.is_active }) });
      else await api('/api/admin/users/' + row.id, { method: 'DELETE' });
      await refresh(); msg.success('Đã cập nhật tài khoản');
    } catch (e) { msg.error(e instanceof Error ? e.message : 'Không thể cập nhật'); }
    finally { setBusy(null); }
  }
  return <AppShell>{holder}<div className="role-page admin-page">
    <div className="role-heading"><div><span className="eyebrow">QUẢN TRỊ / TÀI KHOẢN</span><h1>Tài khoản hệ thống</h1><p>Tìm, quản lý vai trò và xác minh doanh nghiệp.</p></div><Button type="primary" onClick={() => show(null)}>Thêm tài khoản</Button></div>
    <Space wrap style={{ marginBottom: 18 }}><Input.Search placeholder="Username hoặc email" value={query} onChange={e => setQuery(e.target.value)} onSearch={() => void refresh()} allowClear /><Select value={role} onChange={setRole} style={{ width: 150 }} options={[{ value: '', label: 'Tất cả vai trò' }, { value: 'STUDENT', label: 'Sinh viên' }, { value: 'EMPLOYER', label: 'Doanh nghiệp' }, { value: 'ADMIN', label: 'Admin' }]} /><Button onClick={() => void refresh()}>Lọc</Button></Space>
    {error && <Alert type="error" title={error} />}
    {loading ? <Skeleton active /> : <Card className="admin-table-card"><Table rowKey="id" dataSource={rows} scroll={{ x: 850 }} columns={[
      { title: 'Tên', dataIndex: 'name' }, { title: 'Username', dataIndex: 'username' }, { title: 'Email', dataIndex: 'email' },
      { title: 'Vai trò', dataIndex: 'role', render: (v: string) => <Tag>{v}</Tag> },
      { title: 'Trạng thái', render: (_: unknown, row: User) => <Tag color={row.deleted_at ? 'default' : row.is_active ? 'green' : 'orange'}>{row.deleted_at ? 'Đã xóa' : row.is_active ? 'Hoạt động' : 'Đã khóa'}</Tag> },
      { title: 'Thao tác', render: (_: unknown, row: User) => row.deleted_at ? null : <Space wrap>
        <Button size="small" onClick={() => show(row)}>Sửa</Button>
        {row.role === 'EMPLOYER' && <Button size="small" loading={busy === row.id} onClick={() => void action(row, 'verify')}>{row.is_verified ? 'Thu hồi duyệt' : 'Duyệt'}</Button>}
        <Button size="small" loading={busy === row.id} onClick={() => void action(row, 'active')}>{row.is_active ? 'Khóa' : 'Mở khóa'}</Button>
        <Button size="small" danger loading={busy === row.id} onClick={() => Modal.confirm({ title: 'Xóa mềm tài khoản?', content: 'Lịch sử ca và giao dịch được giữ lại.', onOk: () => action(row, 'delete') })}>Xóa</Button>
      </Space> },
    ]} /></Card>}
    <Modal title={editing ? 'Sửa tài khoản' : 'Thêm tài khoản'} open={open} onOk={() => void save()} confirmLoading={busy === 'form'} onCancel={() => setOpen(false)} destroyOnHidden>
      <Form form={form} layout="vertical"><Form.Item name="name" label="Tên hiển thị" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="username" label="Username" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}><Input /></Form.Item>
        {!editing && <Form.Item name="password" label="Mật khẩu ban đầu" rules={[{ required: true, min: 8 }]}><Input.Password /></Form.Item>}
        <Form.Item name="role" label="Vai trò" rules={[{ required: true }]}><Select options={[{ value: 'STUDENT', label: 'Sinh viên' }, { value: 'EMPLOYER', label: 'Doanh nghiệp' }, { value: 'ADMIN', label: 'Admin' }]} /></Form.Item>
        {editing && <Form.Item name="is_active" label="Hoạt động" valuePropName="checked"><Switch /></Form.Item>}
      </Form>
    </Modal>
  </div></AppShell>;
}
