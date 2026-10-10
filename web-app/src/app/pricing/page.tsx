'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert, Button, Card, Empty, Skeleton } from 'antd';
import { api } from '@/lib/api';

type Plan = { id: string; code: string; name: string; price: number; post_limit: number; duration_days: number | null; description: string };
const money = (value: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
export default function Pricing() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [error, setError] = useState('');
  const [buying, setBuying] = useState<string | null>(null);
  const [paymentsReady, setPaymentsReady] = useState(false);
  useEffect(() => { api<Plan[]>('/api/plans').then(setPlans).catch(e => setError(e.message)); }, []);
  useEffect(() => { api<{ available: boolean }>('/api/payments/config').then(value => setPaymentsReady(value.available)).catch(() => setPaymentsReady(false)); }, []);
  async function buy(plan: Plan) {
    setError(''); setBuying(plan.id);
    try {
      const order = await api<{ checkout_url: string }>('/api/employer/checkout', { method: 'POST', body: JSON.stringify({ plan_id: plan.id }) });
      router.push(order.checkout_url);
    } catch (e) { setError(e instanceof Error ? e.message : 'Không thể tạo đơn hàng'); setBuying(null); }
  }
  return <main style={{ maxWidth: 1150, margin: 'auto', padding: '42px 20px' }}>
    <Link href="/">← EduShift</Link><h1>Bảng giá đăng ca</h1><p>Gói Free có 5 lượt đăng ca tổng cộng. Giá và hạn mức gói trả phí do EduShift cấu hình.</p>
    {error && <Alert type="error" title={error} style={{ marginBottom: 20 }} />}
    {!plans && !error && <Skeleton active />}
    {plans?.length === 0 && <Empty description="Chưa có gói đang bán" />}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, marginTop: 28 }}>
      {plans?.map(plan => <Card key={plan.id} title={plan.name}>
        <h2>{money(plan.price)}</h2><p>{plan.description}</p>
        <p>{plan.post_limit} lượt đăng ca{plan.duration_days ? ` / ${plan.duration_days} ngày` : ' tổng cộng'}</p>
        {plan.code === 'FREE' ? <Link href="/register">Đăng ký miễn phí</Link> : <Button type="primary" loading={buying === plan.id} disabled={Boolean(buying) || !paymentsReady} onClick={() => void buy(plan)}>{paymentsReady ? 'Mua gói' : 'Thanh toán chưa mở'}</Button>}
      </Card>)}
    </div>
  </main>;
}
