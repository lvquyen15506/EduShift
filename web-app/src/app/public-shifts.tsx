'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type PublicShift = { id: string; title: string; company_name: string; location: string; start_time: string; end_time: string; hourly_rate: number | null; remaining_workers: number };

const dateFormat = new Intl.DateTimeFormat('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' });
const timeFormat = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });

export default function PublicShifts() {
  const [items, setItems] = useState<PublicShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    fetch('/api/public/shifts?limit=6').then(response => response.ok ? response.json() : Promise.reject(new Error('request failed')))
      .then(data => { if (active) setItems(data.items ?? []); })
      .catch(() => { if (active) setFailed(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  return <section className="landing-public-shifts" id="ca-dang-tuyen">
    <div className="landing-public-shifts-head"><div><span className="landing-label">CƠ HỘI ĐANG MỞ</span><h2>Ca làm mới, vừa khít<br /><em>lịch của bạn.</em></h2></div><p>Khám phá những ca đang tuyển từ các doanh nghiệp đã được xác minh. Đăng nhập để xem chi tiết và ứng tuyển.</p></div>
    {loading && <div className="landing-shift-grid" aria-label="Đang tải ca làm">{[1, 2, 3].map(item => <div className="landing-shift-skeleton" key={item} />)}</div>}
    {!loading && failed && <div className="landing-shift-empty" role="status">Chưa thể tải danh sách ca. Bạn vẫn có thể đăng ký để xem toàn bộ cơ hội.</div>}
    {!loading && !failed && items.length === 0 && <div className="landing-shift-empty" role="status">Hiện chưa có ca phù hợp đang tuyển. Hãy quay lại sau nhé.</div>}
    {!loading && !failed && items.length > 0 && <div className="landing-shift-grid">{items.map(item => <article className="landing-shift-card" key={item.id}>
      <div className="landing-shift-card-top"><span className="landing-shift-badge">ĐANG TUYỂN</span><span className="landing-shift-places">{item.remaining_workers} chỗ trống</span></div>
      <h3>{item.title}</h3><p className="landing-shift-company">{item.company_name}</p>
      <div className="landing-shift-meta"><span>◷ {dateFormat.format(new Date(item.start_time))} · {timeFormat.format(new Date(item.start_time))}–{timeFormat.format(new Date(item.end_time))}</span><span>⌖ {item.location}</span></div>
      <div className="landing-shift-card-foot"><strong>{(item.hourly_rate ?? 0).toLocaleString('vi-VN')}đ<small>/giờ</small></strong><Link href="/register">Xem ca <span aria-hidden="true">↗</span></Link></div>
    </article>)}</div>}
    {!loading && !failed && items.length > 0 && <Link href="/register" className="landing-public-shifts-link">Xem thêm cơ hội <span aria-hidden="true">→</span></Link>}
  </section>;
}
