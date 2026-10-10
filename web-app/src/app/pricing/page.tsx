'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert, Button, Card, Empty, Skeleton } from 'antd';
import { api } from '@/lib/api';
import AppShell from '@/components/AppShell';

type Plan = { id: string; code: string; name: string; price: number; post_limit: number; duration_days: number | null; description: string };
const money = (value: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
export default function Pricing() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [error, setError] = useState('');
  const [buying, setBuying] = useState<string | null>(null);
  const [paymentsReady, setPaymentsReady] = useState(false);
  const [shellRole] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    try { return JSON.parse(localStorage.getItem('user') || '{}').role || null; } catch { return null; }
  });
  useEffect(() => { api<Plan[]>('/api/plans').then(setPlans).catch(e => setError(e.message)); }, []);
  useEffect(() => { api<{ available: boolean }>('/api/payments/config').then(value => setPaymentsReady(value.available)).catch(() => setPaymentsReady(false)); }, []);
  async function buy(plan: Plan) {
    if (!localStorage.getItem('user')) { router.push('/login?next=' + encodeURIComponent('/pricing')); return; }
    setError(''); setBuying(plan.id);
    try {
      const order = await api<{ checkout_url: string }>('/api/employer/checkout', { method: 'POST', body: JSON.stringify({ plan_id: plan.id }) });
      router.push(order.checkout_url);
    } catch (e) { setError(e instanceof Error ? e.message : 'Không thể tạo đơn hàng'); setBuying(null); }
  }
  const content = <div className="pricing-page"><div className="page-heading"><div><span className="eyebrow">DOANH NGHIỆP / GÓI ĐĂNG CA</span><h1>Bảng giá đăng ca</h1><p>Chọn gói phù hợp để tiếp tục đăng ca và tìm ứng viên.</p></div><Link className="pricing-back" href={shellRole ? '/dashboard' : '/'}>← Quay lại</Link></div>
    {error && <Alert type="error" title={error} style={{ marginBottom: 20 }} />}
    {!plans && !error && <Skeleton active />}
    {plans?.length === 0 && <Empty description="Chưa có gói đang bán" />}
    <div className="pricing-grid">{plans?.map(plan => <Card key={plan.id} className={'pricing-card ' + (plan.code === 'FREE' ? 'pricing-card-free' : 'pricing-card-featured')} title={<div className="pricing-card-title"><span>{plan.name}</span>{plan.code !== 'FREE' && <small>Đề xuất</small>}</div>}>
      <div className="pricing-price">{money(plan.price)}</div><p className="pricing-description">{plan.description}</p><div className="pricing-limit">{plan.post_limit} lượt đăng ca{plan.duration_days ? ` / ${plan.duration_days} ngày` : ' tổng cộng'}</div>
      {plan.code === 'FREE' ? <Link className="pricing-button pricing-button-secondary" href={shellRole === 'EMPLOYER' ? '/shifts/new' : '/register'}>{shellRole === 'EMPLOYER' ? 'Đăng ca mới' : 'Bắt đầu miễn phí'} <span>→</span></Link> : <Button className="pricing-button" type="primary" loading={buying === plan.id} disabled={Boolean(buying) || !paymentsReady} onClick={() => void buy(plan)}>{paymentsReady ? 'Mua gói ngay' : 'Thanh toán chưa mở'} <span>→</span></Button>}
    </Card>)}</div></div>;
  return shellRole ? <AppShell>{content}</AppShell> : <main className="pricing-public-shell">{content}</main>;
}
