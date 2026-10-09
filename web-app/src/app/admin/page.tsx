'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Card, Empty, Skeleton, Table, Tag } from 'antd';
import { AuditOutlined, CalendarOutlined, FileDoneOutlined, TeamOutlined, UserOutlined } from '@ant-design/icons';
import AppShell from '@/components/AppShell';
import { api } from '@/lib/api';
type User = { id: string; name: string; email: string | null; role: string; created_at: string };
type Data = { stats: { users: number; students: number; employers: number; shifts: number; applications: number; unverified_employers: number }; recent_users: User[] };
export default function AdminDashboard() {
  const [data, setData] = useState<Data | null>(null); const [error, setError] = useState('');
  useEffect(() => { api<Data>('/api/admin/dashboard').then(setData).catch(e => setError(e.message)); }, []);
  const stats = data ? [{ label: 'Tổng tài khoản', value: data.stats.users, icon: <TeamOutlined />, tone: 'pink' }, { label: 'Sinh viên', value: data.stats.students, icon: <UserOutlined />, tone: 'green' }, { label: 'Doanh nghiệp', value: data.stats.employers, icon: <AuditOutlined />, tone: 'yellow' }, { label: 'Ca làm việc', value: data.stats.shifts, icon: <CalendarOutlined />, tone: 'purple' }, { label: 'Đơn ứng tuyển', value: data.stats.applications, icon: <FileDoneOutlined />, tone: 'pink' }, { label: 'Chờ xác minh', value: data.stats.unverified_employers, icon: <AuditOutlined />, tone: 'yellow' }] : [];
  return <AppShell><div className="role-page admin-page"><div className="role-heading"><div><span className="eyebrow">QUẢN TRỊ HỆ THỐNG</span><h1>Tổng quan nền tảng</h1><p>Theo dõi tài khoản, doanh nghiệp và hoạt động tuyển dụng trên EduShift.</p></div><Tag color="green">Hệ thống đang hoạt động</Tag></div>{error && <Alert type="error" title={error} />}{!data ? <Skeleton active /> : <><div className="role-metrics admin-metrics">{stats.map(item => <Card key={item.label}><div className={'metric-icon ' + item.tone}>{item.icon}</div><small>{item.label}</small><strong>{item.value}</strong></Card>)}</div><div className="role-section-head"><div><span className="eyebrow">HOẠT ĐỘNG GẦN ĐÂY</span><h2>Tài khoản mới</h2></div><Link href="/admin/users">Xem tài khoản →</Link></div><Card className="admin-table-card"><Table rowKey="id" dataSource={data.recent_users} locale={{ emptyText: <Empty description="Chưa có tài khoản" /> }} pagination={false} columns={[{ title: 'Tài khoản', dataIndex: 'name' }, { title: 'Email', dataIndex: 'email' }, { title: 'Vai trò', dataIndex: 'role', render: (role: string) => <Tag color={role === 'ADMIN' ? 'purple' : role === 'STUDENT' ? 'green' : 'magenta'}>{role === 'ADMIN' ? 'Quản trị' : role === 'STUDENT' ? 'Sinh viên' : 'Doanh nghiệp'}</Tag> }, { title: 'Ngày tạo', dataIndex: 'created_at', render: (date: string) => new Date(date).toLocaleDateString('vi-VN') }]} /></Card></>}</div></AppShell>;
}
