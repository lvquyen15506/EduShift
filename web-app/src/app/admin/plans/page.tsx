'use client';
import { useEffect, useState } from 'react';
import { Alert, Button, Card, Form, Input, InputNumber, Modal, Switch, Table, Tag, message } from 'antd';
import AppShell from '@/components/AppShell';
import { api } from '@/lib/api';

type Plan = { id: string; code: string; name: string; price: number; post_limit: number; duration_days: number; description: string; is_active: boolean };
const money = (value: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
export default function AdminPlans() {
  const [rows, setRows] = useState<Plan[]>([]);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form] = Form.useForm();
  const [msg, holder] = message.useMessage();
  async function refresh() { try { setRows(await api<Plan[]>('/api/admin/plans')); setError(''); } catch (e) { setError(e instanceof Error ? e.message : 'Không thể tải gói'); } }
  useEffect(() => { api<Plan[]>('/api/admin/plans').then(setRows).catch(e => setError(e instanceof Error ? e.message : 'Không thể tải gói')); }, []);
  function show(row: Plan | null) { setEditing(row); form.setFieldsValue(row || { is_active: true }); setOpen(true); }
  async function save() {
    let values: Record<string, unknown>;
    try { values = await form.validateFields(); } catch { return; }
    setBusy(true);
    try {
      await api(editing ? '/api/admin/plans/' + editing.id : '/api/admin/plans', {
        method: editing ? 'PATCH' : 'POST', body: JSON.stringify(values),
      });
      setOpen(false); form.resetFields(); await refresh(); msg.success('Đã lưu gói');
    } catch (e) { msg.error(e instanceof Error ? e.message : 'Không thể lưu gói'); }
    finally { setBusy(false); }
  }
  return <AppShell>{holder}<div className="role-page admin-page"><div className="role-heading"><div><span className="eyebrow">QUẢN TRỊ / BẢNG GIÁ</span><h1>Gói đăng ca</h1><p>Giá và hạn mức được áp dụng từ server. Giao dịch cũ giữ điều khoản tại lúc mua.</p></div><Button type="primary" onClick={() => show(null)}>Thêm gói</Button></div>
    {error && <Alert type="error" title={error} />}
    <Card className="admin-table-card"><Table rowKey="id" dataSource={rows} scroll={{ x: 700 }} columns={[
      { title: 'Gói', dataIndex: 'name' }, { title: 'Mã', dataIndex: 'code' },
      { title: 'Giá', dataIndex: 'price', render: money },
      { title: 'Lượt', dataIndex: 'post_limit' }, { title: 'Ngày', dataIndex: 'duration_days', render: (v: number | null) => v ?? 'Không hết hạn' },
      { title: 'Trạng thái', dataIndex: 'is_active', render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? 'Đang bán' : 'Ngừng bán'}</Tag> },
      { title: 'Thao tác', render: (_: unknown, row: Plan) => row.code === 'FREE' ? null : <Button onClick={() => show(row)}>Sửa</Button> },
    ]} /></Card>
    <Modal title={editing ? 'Sửa gói' : 'Thêm gói'} open={open} onOk={() => void save()} confirmLoading={busy} onCancel={() => setOpen(false)} destroyOnHidden>
      <Form form={form} layout="vertical"><Form.Item name="code" label="Mã gói" rules={[{ required: true }]}><Input disabled={Boolean(editing)} /></Form.Item>
        <Form.Item name="name" label="Tên gói" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="price" label="Giá VNĐ" rules={[{ required: true }]}><InputNumber min={1000} style={{ width: '100%' }} /></Form.Item>
        <Form.Item name="post_limit" label="Lượt đăng ca" rules={[{ required: true }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item>
        <Form.Item name="duration_days" label="Thời hạn (ngày)" rules={[{ required: true }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item>
        <Form.Item name="description" label="Quyền lợi"><Input.TextArea rows={3} /></Form.Item>
        <Form.Item name="is_active" label="Đang bán" valuePropName="checked"><Switch /></Form.Item>
      </Form>
    </Modal>
  </div></AppShell>;
}
