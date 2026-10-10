'use client';
import { useEffect, useState } from 'react';
import { Alert, Button, Card, Form, Input, Modal, Space, Switch, Table, Tag, message } from 'antd';
import AppShell from '@/components/AppShell';
import { api } from '@/lib/api';

type Policy = { kind: string; title_template: string; body_template: string; in_app_enabled: boolean; email_enabled: boolean; push_enabled: boolean; version: number };
type Preview = { title: string; body: string };
export default function AdminNotifications() {
  const [rows, setRows] = useState<Policy[]>([]);
  const [editing, setEditing] = useState<Policy | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form] = Form.useForm();
  const [msg, holder] = message.useMessage();
  useEffect(() => { api<Policy[]>('/api/admin/notification-policies').then(setRows).catch(e => setError(e.message)); }, []);
  function show(row: Policy) { setEditing(row); setPreview(null); form.setFieldsValue(row); }
  async function save() {
    if (!editing) return;
    let values: Record<string, unknown>;
    try { values = await form.validateFields(); } catch { return; }
    setBusy(true);
    try {
      const updated = await api<Policy>('/api/admin/notification-policies/' + editing.kind, { method: 'PATCH', body: JSON.stringify(values) });
      setRows(current => current.map(row => row.kind === updated.kind ? updated : row));
      setEditing(null); msg.success('Đã lưu cấu hình');
    } catch (e) { msg.error(e instanceof Error ? e.message : 'Không thể lưu cấu hình'); }
    finally { setBusy(false); }
  }
  async function loadPreview() {
    if (!editing) return;
    try { setPreview(await api<Preview>('/api/admin/notification-policies/' + editing.kind + '/preview')); }
    catch (e) { msg.error(e instanceof Error ? e.message : 'Không thể xem trước'); }
  }
  return <AppShell>{holder}<div className="role-page admin-page"><div className="role-heading"><div><span className="eyebrow">QUẢN TRỊ / THÔNG BÁO</span><h1>Cấu hình thông báo</h1><p>Mẫu chỉ dùng {'{title}'} và {'{body}'}. OTP và email bảo mật không nằm trong cấu hình này.</p></div></div>
    {error && <Alert type="error" title={error} />}
    <Card className="admin-table-card"><Table rowKey="kind" dataSource={rows} scroll={{ x: 700 }} columns={[
      { title: 'Loại', dataIndex: 'kind' }, { title: 'Phiên bản', dataIndex: 'version' },
      { title: 'Kênh bật', render: (_: unknown, row: Policy) => <Space wrap>{row.in_app_enabled && <Tag>Trong ứng dụng</Tag>}{row.email_enabled && <Tag>Email</Tag>}{row.push_enabled && <Tag>Push</Tag>}</Space> },
      { title: 'Thao tác', render: (_: unknown, row: Policy) => <Button onClick={() => show(row)}>Sửa</Button> },
    ]} /></Card>
    <Modal title={editing ? 'Mẫu ' + editing.kind : ''} open={Boolean(editing)} onOk={() => void save()} confirmLoading={busy} onCancel={() => setEditing(null)} destroyOnHidden>
      <Form form={form} layout="vertical"><Form.Item name="title_template" label="Tiêu đề" rules={[{ required: true }]}><Input maxLength={220} /></Form.Item>
        <Form.Item name="body_template" label="Nội dung" rules={[{ required: true }]}><Input.TextArea rows={4} maxLength={2000} /></Form.Item>
        <Form.Item name="in_app_enabled" label="Trong ứng dụng" valuePropName="checked"><Switch /></Form.Item>
        <Form.Item name="email_enabled" label="Email" valuePropName="checked"><Switch /></Form.Item>
        <Form.Item name="push_enabled" label="Push" valuePropName="checked"><Switch /></Form.Item>
      </Form>
      <Button onClick={() => void loadPreview()}>Xem trước bản đã lưu</Button>
      {preview && <Alert type="info" title={preview.title} description={preview.body} style={{ marginTop: 12 }} />}
    </Modal>
  </div></AppShell>;
}
