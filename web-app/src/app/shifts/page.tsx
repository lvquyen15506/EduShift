'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Alert, Button, Empty, Input, message, Skeleton, Tag } from 'antd';
import { CalendarOutlined, EnvironmentOutlined, PlusOutlined, SearchOutlined, TeamOutlined } from '@ant-design/icons';
import AppShell from '@/components/AppShell';
import { api } from '@/lib/api';

type Shift = { id: string; title: string; location: string; start_time: string; end_time: string; status: string; applicants: number };
const labels: Record<string, string> = { OPEN: 'Đang tuyển', FULL: 'Đã đủ người', CLOSED: 'Đã đóng tuyển', DRAFT: 'Bản nháp' };

export default function Shifts() {
  const [rows, setRows] = useState<Shift[] | null>(null);
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => { api<Shift[]>('/api/shifts').then(setRows).catch(cause => setError(cause.message)); }, []);
  const filtered = useMemo(() => (rows || []).filter(row => (filter === 'ALL' || row.status === filter) && (row.title + ' ' + row.location).toLowerCase().includes(search.toLowerCase())), [rows, filter, search]);

  async function toggleStatus(shift: Shift) {
    if (saving || !['OPEN', 'CLOSED'].includes(shift.status)) return;
    setSaving(shift.id);
    try {
      const status = shift.status === 'OPEN' ? 'CLOSED' : 'OPEN';
      const result = await api<{ status: string }>('/api/shifts/' + encodeURIComponent(shift.id) + '/status', { method: 'PATCH', body: JSON.stringify({ status }) });
      setRows(current => current?.map(item => item.id === shift.id ? { ...item, status: result.status } : item) || []);
      messageApi.success(result.status === 'CLOSED' ? 'Đã đóng tuyển ca này' : 'Đã mở lại ca');
    } catch (cause) { messageApi.error(cause instanceof Error ? cause.message : 'Không cập nhật được ca'); }
    finally { setSaving(null); }
  }

  return <AppShell>{contextHolder}<div className="role-page employer-page">
    <div className="role-heading"><div><span className="eyebrow">DOANH NGHIỆP / TUYỂN DỤNG</span><h1>Ca làm việc</h1><p>Tạo và theo dõi các ca làm việc đang tuyển.</p></div><Link href="/shifts/new" className="action-button"><button className="primary"><PlusOutlined /> Đăng ca mới</button></Link></div>
    {error && <Alert type="error" title={error} />}
    {!rows ? (error ? null : <Skeleton active />) : <><div className="toolbar"><div className="tabs">{[['ALL','Tất cả'],['OPEN','Đang tuyển'],['FULL','Đã đủ người'],['CLOSED','Đã đóng']].map(([value, label]) => <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}</button>)}</div><Input prefix={<SearchOutlined />} placeholder="Tìm ca làm việc..." value={search} onChange={event => setSearch(event.target.value)} style={{ width: 240 }} /></div>
      <section className="panel table-panel"><div className="table-head"><span>CA LÀM VIỆC</span><span>THỜI GIAN</span><span>ỨNG VIÊN</span><span>TRẠNG THÁI</span><span /></div>
        {filtered.length ? filtered.map(shift => <div className="table-row" key={shift.id}><div><b>{shift.title}</b><small><EnvironmentOutlined /> {shift.location}</small></div><div><b><CalendarOutlined /> {new Date(shift.start_time).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}</b><small>{new Date(shift.end_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</small></div><b><TeamOutlined /> {shift.applicants}</b><Tag color={shift.status === 'OPEN' ? 'green' : 'default'}>{labels[shift.status] || shift.status}</Tag><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><Link href={'/candidates?shift_id=' + shift.id} className="candidate-link">Xem ứng viên</Link>{['OPEN', 'CLOSED'].includes(shift.status) && <Button size="small" loading={saving === shift.id} disabled={Boolean(saving)} onClick={() => void toggleStatus(shift)}>{shift.status === 'OPEN' ? 'Đóng tuyển' : 'Mở lại'}</Button>}</div></div>) : <div className="empty-table"><Empty description="Không có ca phù hợp" /></div>}
      </section></>}
  </div></AppShell>;
}
