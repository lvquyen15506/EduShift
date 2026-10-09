'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Button, Card, Empty, Skeleton, Tag } from 'antd';
import { ArrowRightOutlined, CalendarOutlined, CheckCircleOutlined, ClockCircleOutlined, SearchOutlined } from '@ant-design/icons';
import AppShell from '@/components/AppShell';
import { api } from '@/lib/api';
type Shift = { id: string; title: string; location: string; start_time: string; end_time: string; hourly_rate: number; required_skills: string[] };
type Data = { stats: { available_shifts: number; pending_applications: number; accepted_applications: number }; recommended_shifts: Shift[] };
export default function StudentHome() {
  const [data, setData] = useState<Data | null>(null); const [error, setError] = useState('');
  useEffect(() => { api<Data>('/api/student/dashboard').then(setData).catch(e => setError(e.message)); }, []);
  return <AppShell><div className="role-page student-page">
    <div className="role-hero"><div><span className="eyebrow">BẢNG ĐIỀU KHIỂN SINH VIÊN</span><h1>Chọn ca vừa lịch học của bạn</h1><p>Việc làm theo ca, thông tin rõ ràng và chủ động thời gian.</p><div className="student-hero-actions"><Link href="/student/shifts"><Button type="primary" icon={<SearchOutlined />}>Khám phá ca làm</Button></Link><Link href="/student/schedule"><Button icon={<CalendarOutlined />}>Xem lịch học</Button></Link></div></div><div className="hero-symbol"><CalendarOutlined /><span>Lịch học của bạn là ưu tiên</span></div></div>
    {error && <Alert type="error" title={error} />}
    {!data ? <Skeleton active /> : <>
      <div className="role-metrics"><Card><div className="metric-icon pink"><SearchOutlined /></div><small>Ca đang mở</small><strong>{data.stats.available_shifts}</strong><span>Cơ hội đang chờ bạn</span></Card><Card><div className="metric-icon yellow"><ClockCircleOutlined /></div><small>Đơn đang chờ</small><strong>{data.stats.pending_applications}</strong><span>Đang được doanh nghiệp xem xét</span></Card><Card><div className="metric-icon green"><CheckCircleOutlined /></div><small>Đã được nhận</small><strong>{data.stats.accepted_applications}</strong><span>Ca làm đã xác nhận</span></Card></div>
      <div className="role-section-head"><div><span className="eyebrow">DÀNH CHO BẠN</span><h2>Ca làm đang tuyển</h2><p>Chọn vị trí phù hợp và xem đầy đủ thông tin trước khi ứng tuyển.</p></div><Link href="/student/shifts">Xem tất cả <ArrowRightOutlined /></Link></div>
      <div className="role-cards">{data.recommended_shifts.length ? data.recommended_shifts.map(shift => <Card key={shift.id} className="job-card"><Tag color="magenta">Đang tuyển</Tag><h3>{shift.title}</h3><p>{shift.location}</p><div className="job-meta"><span><CalendarOutlined /> {new Date(shift.start_time).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}</span><span>{Number(shift.hourly_rate || 0).toLocaleString('vi-VN')} ₫/giờ</span></div><div className="job-tags">{shift.required_skills.map(skill => <Tag key={skill}>{skill}</Tag>)}</div><Link href="/student/shifts"><Button block>Xem ca làm <ArrowRightOutlined /></Button></Link></Card>) : <Empty description="Chưa có ca làm đang mở" />}</div>
    </>}
  </div></AppShell>;
}
