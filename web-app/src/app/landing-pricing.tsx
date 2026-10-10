'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

type Plan = { id: string; code: string; name: string; price: number; post_limit: number; duration_days: number | null; description: string };
const money = (value: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
export default function LandingPricing() {
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => { api<Plan[]>('/api/plans').then(setPlans).catch(() => setError(true)); }, []);
  return <section className="landing-section landing-pricing" id="bang-gia"><div className="landing-section-head"><div><span className="landing-label">DÀNH CHO DOANH NGHIỆP</span><h2>Gói đăng ca rõ ràng.</h2></div><p>Bắt đầu với 5 lượt Free tổng cộng. Gói trả phí do EduShift cấu hình và hiển thị theo giá hiện hành.</p></div>
    {!plans && !error && <p role="status">Đang tải bảng giá…</p>}
    {error && <p role="alert">Chưa tải được bảng giá. <Link href="/pricing">Thử lại tại trang bảng giá</Link>.</p>}
    {plans && <div className="landing-pricing-grid">{plans.slice(0, 3).map(plan => <article key={plan.id}><span>{plan.name}</span><h3>{money(plan.price)}</h3><p>{plan.post_limit} lượt đăng ca{plan.duration_days ? ` / ${plan.duration_days} ngày` : ' tổng cộng'}</p><small>{plan.description}</small><Link href={plan.code === 'FREE' ? '/register' : '/pricing'}>{plan.code === 'FREE' ? 'Bắt đầu miễn phí' : 'Xem gói'} ↗</Link></article>)}</div>}
    <Link href="/pricing" className="landing-pricing-all">Xem toàn bộ bảng giá →</Link>
  </section>;
}
