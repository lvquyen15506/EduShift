'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Alert, Button, Empty, Modal, Popconfirm, Spin, Tag, message } from 'antd';
import { CalendarOutlined, DeleteOutlined, LeftOutlined, PlusOutlined, RightOutlined, SyncOutlined } from '@ant-design/icons';
import AppShell from '@/components/AppShell';
import { api } from '@/lib/api';

type ScheduleType = 'STUDY' | 'BUSY' | 'FREE' | 'WORK';
type ScheduleItem = {
  id: string;
  title: string;
  type: ScheduleType;
  source: 'SCHOOL' | 'MANUAL' | 'SHIFT';
  start_time: string;
  end_time: string;
};

const labels: Record<ScheduleType, string> = { STUDY: 'Lịch học', BUSY: 'Bận', FREE: 'Rảnh', WORK: 'Ca làm' };
const tones: Record<ScheduleType, string> = { STUDY: 'study', BUSY: 'busy', FREE: 'free', WORK: 'work' };
const weekday = ['Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy', 'Chủ nhật'];
const dateKey = (date: Date) => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
function weekMonday(date: Date) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  result.setDate(result.getDate() - ((result.getDay() + 6) % 7));
  return result;
}
function localDateTime(day: string, time: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const parsed = new Date(day + 'T' + time + ':00');
  const [year, month, date] = day.split('-').map(Number);
  return parsed.getFullYear() === year && parsed.getMonth() + 1 === month && parsed.getDate() === date ? parsed : null;
}
const timeLabel = (value: string) => new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
const errorText = (error: unknown) => error instanceof Error ? error.message : 'Không thể hoàn tất thao tác.';

export default function StudentSchedule() {
  const [items, setItems] = useState<ScheduleItem[] | null>(null);
  const [error, setError] = useState('');
  const [week, setWeek] = useState(() => weekMonday(new Date()));
  const [today] = useState(() => dateKey(new Date()));
  const [manualOpen, setManualOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [schoolUser, setSchoolUser] = useState('');
  const [schoolPass, setSchoolPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const load = useCallback(() => api<ScheduleItem[]>('/api/schedules')
    .then(data => { setItems(data); setError(''); })
    .catch(cause => { setError(errorText(cause)); }), []);
  useEffect(() => { void load(); }, [load]);

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(week);
    date.setDate(date.getDate() + index);
    return date;
  });
  const weekEnd = days[6];
  const weekLabel = week.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) + ' – ' + weekEnd.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

  async function addManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const day = String(form.get('day') || '');
    const start = localDateTime(day, String(form.get('start') || ''));
    const end = localDateTime(day, String(form.get('end') || ''));
    const type = String(form.get('type') || 'STUDY') as ScheduleType;
    const title = String(form.get('title') || '').trim();
    if (!start || !end || end <= start) { messageApi.error('Kiểm tra lại ngày và giờ bắt đầu, kết thúc.'); return; }
    if (type !== 'FREE' && !title) { messageApi.error('Nhập tên mục lịch.'); return; }
    setBusy(true);
    try {
      await api('/api/schedules', { method: 'POST', body: JSON.stringify({ title: title || 'Rảnh', type, start_time: start.toISOString(), end_time: end.toISOString() }) });
      setManualOpen(false);
      setWeek(weekMonday(start));
      await load();
      messageApi.success('Đã thêm vào lịch');
    } catch (cause) { messageApi.error(errorText(cause)); }
    finally { setBusy(false); }
  }

  async function remove(item: ScheduleItem) {
    if (busy) return;
    setBusy(true);
    try {
      await api('/api/schedules/' + encodeURIComponent(item.id), { method: 'DELETE' });
      await load();
      messageApi.success('Đã xóa mục lịch');
    } catch (cause) { messageApi.error(errorText(cause)); }
    finally { setBusy(false); }
  }

  function closeSync() { setSyncOpen(false); setSchoolUser(''); setSchoolPass(''); }
  async function syncSchool(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !schoolUser.trim() || !schoolPass) return;
    setBusy(true);
    try {
      const result = await api<{ synced: number }>('/api/schedules/sync-school', { method: 'POST', body: JSON.stringify({ username: schoolUser.trim(), password: schoolPass }) });
      closeSync();
      await load();
      messageApi.success('Đã đồng bộ ' + result.synced + ' buổi học');
    } catch (cause) { messageApi.error(errorText(cause)); }
    finally { setBusy(false); }
  }

  return <AppShell>{contextHolder}<div className="role-page student-page schedule-page">
    <div className="role-heading"><div><span className="eyebrow">SINH VIÊN / THỜI GIAN CỦA BẠN</span><h1>Lịch học & lịch rảnh</h1><p>EduShift dùng lịch này để tìm ca làm không trùng giờ học.</p></div><div className="schedule-actions"><Button icon={<SyncOutlined />} onClick={() => setSyncOpen(true)}>Đồng bộ lịch trường</Button><Button type="primary" icon={<PlusOutlined />} onClick={() => setManualOpen(true)}>Thêm lịch</Button></div></div>
    {error && <Alert type="error" title="Không tải được lịch" description={error} action={<Button onClick={() => void load()}>Thử lại</Button>} />}
    <section className="schedule-calendar panel" aria-label="Lịch theo tuần">
      <div className="schedule-toolbar"><div><CalendarOutlined /><strong>Tuần {weekLabel}</strong></div><div><Button size="small" onClick={() => setWeek(weekMonday(new Date()))}>Hôm nay</Button><Button size="small" aria-label="Tuần trước" icon={<LeftOutlined />} onClick={() => setWeek(current => { const next = new Date(current); next.setDate(next.getDate() - 7); return next; })} /><Button size="small" aria-label="Tuần sau" icon={<RightOutlined />} onClick={() => setWeek(current => { const next = new Date(current); next.setDate(next.getDate() + 7); return next; })} /></div></div>
      {!items ? <div className="schedule-loading"><Spin /></div> : <div className="schedule-week">{days.map((day, index) => {
        const events = items.filter(item => dateKey(new Date(item.start_time)) === dateKey(day));
        return <div className={'schedule-day' + (dateKey(day) === today ? ' is-today' : '')} key={dateKey(day)}><div className="schedule-day-head"><span>{weekday[index]}</span><b>{day.getDate()}</b></div><div className="schedule-day-events">{events.length ? events.map(item => <div className={'schedule-event ' + tones[item.type]} key={item.id}><small>{timeLabel(item.start_time)} – {timeLabel(item.end_time)}</small><b>{item.title || labels[item.type]}</b></div>) : <span className="schedule-day-empty">Chưa có lịch</span>}</div></div>;
      })}</div>}
    </section>
    <div className="schedule-legend"><span><i className="study" />Lịch học</span><span><i className="busy" />Bận</span><span><i className="free" />Rảnh</span><span><i className="work" />Ca đã nhận</span></div>
    <section className="schedule-list-section"><div className="role-section-head"><div><span className="eyebrow">TẤT CẢ MỤC LỊCH</span><h2>Thời gian đã khai báo</h2><p>{items?.length || 0} mục lịch, gồm lịch trường, lịch nhập tay và ca đã nhận.</p></div></div>{items && (items.length ? <div className="schedule-list">{items.map(item => <div className="schedule-list-item panel" key={item.id}><span className={'schedule-list-mark ' + tones[item.type]}><CalendarOutlined /></span><div><b>{item.title || labels[item.type]}</b><small>{new Date(item.start_time).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' })} – {timeLabel(item.end_time)}</small><small>{item.source === 'SCHOOL' ? 'Từ cổng trường' : item.source === 'SHIFT' ? 'Ca đã nhận' : 'Tự thêm'}</small></div><Tag color={item.type === 'FREE' ? 'green' : item.type === 'BUSY' ? 'orange' : item.type === 'WORK' ? 'purple' : 'magenta'}>{labels[item.type]}</Tag>{item.source !== 'SHIFT' && <Popconfirm title="Xóa mục lịch này?" onConfirm={() => void remove(item)} okText="Xóa" cancelText="Hủy"><Button type="text" danger icon={<DeleteOutlined />} aria-label={'Xóa ' + (item.title || labels[item.type])} disabled={busy} /></Popconfirm>}</div>)}</div> : <div className="schedule-empty panel"><Empty description="Chưa có lịch. Hãy thêm lịch hoặc đồng bộ từ cổng trường." /></div>)}</section>
    <Modal title="Thêm lịch thủ công" open={manualOpen} onCancel={() => setManualOpen(false)} footer={null} destroyOnHidden><form className="schedule-form" onSubmit={addManual}><label>Tên mục lịch<input name="title" maxLength={200} placeholder="Ví dụ: Toán cao cấp" /></label><label>Loại lịch<select name="type" defaultValue="STUDY"><option value="STUDY">Lịch học</option><option value="BUSY">Bận</option><option value="FREE">Rảnh</option></select></label><label>Ngày<input name="day" type="date" defaultValue={today} required /></label><div className="schedule-form-times"><label>Bắt đầu<input name="start" type="time" defaultValue="08:00" required /></label><label>Kết thúc<input name="end" type="time" defaultValue="10:00" required /></label></div><div className="schedule-form-footer"><Button onClick={() => setManualOpen(false)}>Hủy</Button><Button type="primary" htmlType="submit" loading={busy}>Lưu vào lịch</Button></div></form></Modal>
    <Modal title="Đồng bộ lịch trường" open={syncOpen} onCancel={closeSync} footer={null} destroyOnHidden><form className="schedule-form" onSubmit={syncSchool}><p>Thông tin cổng trường chỉ dùng cho lần đồng bộ này. Lịch tự thêm vẫn được giữ lại.</p><label>Tài khoản cổng trường<input value={schoolUser} onChange={event => setSchoolUser(event.target.value)} autoComplete="username" required placeholder="Mã sinh viên" /></label><label>Mật khẩu cổng trường<input value={schoolPass} onChange={event => setSchoolPass(event.target.value)} type="password" autoComplete="current-password" required placeholder="Mật khẩu" /></label><div className="schedule-form-footer"><Button onClick={closeSync}>Hủy</Button><Button type="primary" htmlType="submit" loading={busy}>Đồng bộ ngay</Button></div></form></Modal>
  </div></AppShell>;
}
