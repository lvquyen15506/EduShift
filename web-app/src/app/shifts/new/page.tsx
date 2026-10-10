'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert } from 'antd';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { api } from '@/lib/api';

export default function NewShift() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const form = new FormData(event.currentTarget);
    const date = String(form.get('date') || '');
    const start = new Date(date + 'T' + form.get('start'));
    const end = new Date(date + 'T' + form.get('end'));
    const rate = Number(form.get('hourly_rate'));
    const workers = Number(form.get('required_workers'));
    const latitudeText = String(form.get('latitude') || '').trim();
    const longitudeText = String(form.get('longitude') || '').trim();
    const latitude = latitudeText ? Number(latitudeText) : null;
    const longitude = longitudeText ? Number(longitudeText) : null;
    if (!date || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start <= new Date() || end <= start) {
      setError('Chọn thời gian trong tương lai và giờ kết thúc sau giờ bắt đầu.'); return;
    }
    if (!Number.isFinite(rate) || rate <= 0 || !Number.isInteger(workers) || workers < 1) {
      setError('Nhập mức lương lớn hơn 0 và số lượng cần tuyển hợp lệ.'); return;
    }
    if (Boolean(latitudeText) !== Boolean(longitudeText) || (latitude !== null && (Math.abs(latitude) > 90 || Math.abs(longitude ?? 0) > 180 || !Number.isFinite(latitude) || !Number.isFinite(longitude)))) {
      setError('Nhập đủ vĩ độ và kinh độ hợp lệ hoặc để trống cả hai.'); return;
    }
    setError(''); setSaving(true);
    try {
      const shift = await api<{ id: string }>('/api/shifts', { method: 'POST', body: JSON.stringify({
        title: String(form.get('title')).trim(), description: String(form.get('description')).trim(),
        location: String(form.get('location')).trim(), required_workers: workers, hourly_rate: rate, latitude, longitude,
        start_time: start.toISOString(), end_time: end.toISOString(),
        required_skills: String(form.get('required_skills') || '').split(',').map(skill => skill.trim()).filter(Boolean),
      }) });
      router.push('/candidates?shift_id=' + encodeURIComponent(shift.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể đăng ca làm việc.');
      setSaving(false);
    }
  }
  return <AppShell><div className="page-heading"><div><span className="eyebrow">QUẢN LÝ CA LÀM VIỆC / CA MỚI</span><h1>Đăng ca làm việc</h1><p>Điền thông tin để tìm đúng người đang rảnh trong ca của bạn.</p></div></div><div className="form-layout"><form className="panel form-panel" onSubmit={submit}>{error && <Alert type="error" title={error} description={<Link href="/pricing">Xem gói đăng ca →</Link>} style={{ marginBottom: 20 }} />}<div className="form-section"><h2>Thông tin ca làm</h2><p>Thông tin này sẽ được hiển thị cho sinh viên phù hợp.</p><label>Tên vị trí<input name="title" required maxLength={200} placeholder="Ví dụ: Nhân viên phục vụ" /></label><label>Mô tả công việc<textarea name="description" required placeholder="Mô tả ngắn gọn công việc và yêu cầu..." /></label><div className="form-two"><label>Địa điểm<input name="location" required placeholder="Tên cửa hàng, địa chỉ" /></label><label>Số lượng cần tuyển<input name="required_workers" required type="number" min="1" step="1" defaultValue="1" /></label></div><label>Kỹ năng cần có (ngăn cách bằng dấu phẩy)<input name="required_skills" placeholder="Ví dụ: giao tiếp, phục vụ" /></label><p>Tọa độ ca (tùy chọn) giúp tính khoảng cách gần đúng khi sinh viên tự cung cấp vị trí.</p><div className="form-two"><label>Vĩ độ<input name="latitude" type="number" min="-90" max="90" step="any" placeholder="21.0285" /></label><label>Kinh độ<input name="longitude" type="number" min="-180" max="180" step="any" placeholder="105.8542" /></label></div></div><div className="form-section"><h2>Thời gian &amp; thu nhập</h2><div className="form-two"><label>Ngày làm việc<input name="date" required type="date" /></label><label>Mức lương / giờ (VNĐ)<input name="hourly_rate" required type="number" min="1" step="1000" placeholder="50000" /></label></div><div className="form-two"><label>Bắt đầu<input name="start" required type="time" /></label><label>Kết thúc<input name="end" required type="time" /></label></div></div><div className="form-actions"><button type="button" className="secondary" onClick={() => router.back()}>Hủy</button><button className="primary" type="submit" disabled={saving}>{saving ? 'Đang đăng ca...' : 'Đăng ca & tìm ứng viên'}</button></div></form><aside className="panel form-aside"><span className="aside-icon">✦</span><h2>Matching tự động</h2><p>EduShift lọc ứng viên dựa trên lịch rảnh và kỹ năng phù hợp.</p><div className="aside-item"><b>✓</b><span>Không xung đột lịch học</span></div><div className="aside-item"><b>✓</b><span>Hiển thị Match Score</span></div><div className="aside-item"><b>✓</b><span>Bảo vệ thông tin lịch cá nhân</span></div></aside></div></AppShell>;
}
