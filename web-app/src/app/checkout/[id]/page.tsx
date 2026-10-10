'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Alert, Button, Card, Skeleton } from 'antd';
import { api } from '@/lib/api';

type Payment = { id: string; plan_name: string; amount: number; post_limit: number; duration_days: number; status: string };
export default function Checkout() {
  const params = useParams<{ id: string }>();
  const [payment, setPayment] = useState<Payment | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { api<Payment>('/api/employer/payments/' + params.id).then(setPayment).catch(e => setError(e.message)); }, [params.id]);
  async function finish(outcome: 'SUCCESS' | 'CANCELLED') {
    setSaving(true); setError('');
    try {
      await api('/api/payments/sandbox/' + params.id, { method: 'POST', body: JSON.stringify({ outcome }) });
      setPayment(await api<Payment>('/api/employer/payments/' + params.id));
    } catch (e) { setError(e instanceof Error ? e.message : 'Không thể xử lý giao dịch'); }
    finally { setSaving(false); }
  }
  return <main style={{ maxWidth: 650, margin: 'auto', padding: '42px 20px' }}><Link href="/pricing">← Bảng giá</Link><h1>Thanh toán sandbox</h1>
    {error && <Alert type="error" title={error} style={{ marginBottom: 20 }} />}
    {!payment && !error && <Skeleton active />}
    {payment && <Card title={payment.plan_name}><p>Số tiền: {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(payment.amount)}</p><p>{payment.post_limit} lượt đăng ca / {payment.duration_days} ngày</p><p>Trạng thái: {payment.status}</p>
      {payment.status === 'PENDING' && <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}><Button type="primary" loading={saving} onClick={() => void finish('SUCCESS')}>Mô phỏng thanh toán thành công</Button><Button disabled={saving} onClick={() => void finish('CANCELLED')}>Hủy</Button></div>}
      {payment.status === 'SUCCESS' && <Link href="/shifts/new">Đăng ca mới →</Link>}
    </Card>}
  </main>;
}
