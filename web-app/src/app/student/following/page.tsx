'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Card, Empty, Skeleton } from 'antd';
import { StarFilled } from '@ant-design/icons';
import AppShell from '@/components/AppShell';
import { api } from '@/lib/api';

type Employer = { id: string; name: string; rating: number | null };

export default function FollowedEmployers() {
  const [rows, setRows] = useState<Employer[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api<Employer[]>('/api/student/followed-employers').then(setRows).catch(cause => setError(cause instanceof Error ? cause.message : 'Không thể tải danh sách'));
  }, []);
  return <AppShell><div className="role-page student-page">
    <div className="role-heading"><div><span className="eyebrow">SINH VIÊN / ĐANG THEO DÕI</span><h1>Doanh nghiệp đã theo dõi</h1><p>Bạn sẽ nhận thông báo khi họ đăng ca mới, kể cả khi ca hiện tại chưa hợp lịch.</p></div></div>
    {error && <Alert type="error" title={error} />}
    {!rows && !error ? <Skeleton active /> : rows?.length ? <div className="role-cards">{rows.map(row => <Card key={row.id} className="job-card"><h3>{row.name}</h3><p><StarFilled /> {row.rating == null ? 'Chưa có đánh giá' : Number(row.rating).toFixed(1) + '/5'}</p><Link className="profile-inline-link" href={'/profiles/employer/' + encodeURIComponent(row.id)}>Xem hồ sơ, đánh giá và các ca đã đăng →</Link></Card>)}</div> : <Empty description="Bạn chưa theo dõi doanh nghiệp nào" />}
  </div></AppShell>;
}
