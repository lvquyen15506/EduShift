'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Card, Skeleton } from 'antd';
import { api } from '@/lib/api';

type PlanInfo = { plan: { name: string; code: string; post_limit: number | null }; posts_used: number; posts_remaining: number | null; free_posts_used: number; expires_at: string | null };
export default function EmployerPlan() {
  const [info, setInfo] = useState<PlanInfo | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { api<PlanInfo>('/api/employer/plan').then(setInfo).catch(e => setError(e.message)); }, []);
  return <Card style={{ marginBottom: 24 }} title="Gói đăng ca">{error && <Alert type="error" title={error} />}{!info && !error && <Skeleton active paragraph={{ rows: 1 }} />}{info && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}><div><strong>{info.plan.name}</strong><p style={{ margin: '8px 0' }}>Đã dùng {info.posts_used} lượt · Còn {info.posts_remaining ?? 'không giới hạn'} lượt</p>{info.expires_at && <small>Hết hạn {new Date(info.expires_at + 'Z').toLocaleDateString('vi-VN')}</small>}</div><Link href="/pricing">{info.posts_remaining === 0 ? 'Đã hết lượt — xem gói →' : 'Xem bảng giá →'}</Link></div>}</Card>;
}
