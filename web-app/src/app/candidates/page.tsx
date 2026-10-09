'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Empty, message, Select, Skeleton, Tag } from 'antd';
import { CheckCircleOutlined, UserOutlined } from '@ant-design/icons';
import AppShell from '@/components/AppShell';
import { api } from '@/lib/api';

type Shift = { id: string; title: string; start_time: string; status: string };
type Candidate = { id: string; name: string; university?: string; major?: string; skills: string[]; match_score: number; match_reasons: string[] };
type Application = { id: string; student_id: string; name: string; university?: string; status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'INVITED' | 'DECLINED'; match_score: number; applied_at: string };
export default function Candidates() {
  const router = useRouter();
  const [shifts, setShifts] = useState<Shift[] | null>(null);
  const [selected, setSelected] = useState('');
  const [rows, setRows] = useState<Candidate[] | null>(null);
  const [candidateId, setCandidateId] = useState('');
  const [applications, setApplications] = useState<Application[] | null>(null);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const [filter, setFilter] = useState<'all' | 'high'>('all');
  const [error, setError] = useState('');
  useEffect(() => {
    api<Shift[]>('/api/shifts').then(items => {
      setShifts(items);
      const requested = new URLSearchParams(window.location.search).get('shift_id');
      setSelected(items.find(item => item.id === requested)?.id || items.find(item => item.status === 'OPEN')?.id || items[0]?.id || '');
    }).catch(cause => setError(cause.message));
  }, []);
  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    api<Candidate[]>('/api/candidates?shift_id=' + encodeURIComponent(selected)).then(items => {
      if (!cancelled) { setRows(items); setCandidateId(items[0]?.id || ''); setError(''); }
    }).catch(cause => { if (!cancelled) { setError(cause.message); setRows([]); } });
    api<Application[]>('/api/shifts/' + encodeURIComponent(selected) + '/applications').then(items => { if (!cancelled) setApplications(items); }).catch(cause => { if (!cancelled) { setError(cause.message); setApplications([]); } });
    return () => { cancelled = true; };
  }, [selected]);
  const accept = async (application: Application) => {
    if (accepting) return;
    setAccepting(application.id);
    try {
      await api('/api/applications/' + encodeURIComponent(application.id) + '/accept', { method: 'PATCH' });
      setApplications(items => items?.map(item => item.id === application.id ? { ...item, status: 'ACCEPTED' } : item) || []);
      messageApi.success('Đã nhận ứng viên và xếp ca vào lịch của sinh viên');
    } catch (cause) { messageApi.error(cause instanceof Error ? cause.message : 'Không thể nhận ứng viên'); }
    finally { setAccepting(null); }
  };
  const visible = useMemo(() => (rows || []).filter(row => filter === 'all' || row.match_score >= 90), [rows, filter]);
  const active = visible.find(row => row.id === candidateId) || visible[0];
  const reject = async (application: Application) => {
    if (accepting) return;
    setAccepting(application.id);
    try {
      await api('/api/applications/' + encodeURIComponent(application.id) + '/reject', { method: 'PATCH' });
      setApplications(items => items?.map(item => item.id === application.id ? { ...item, status: 'REJECTED' } : item) || []);
      messageApi.success('Đã từ chối đơn ứng tuyển');
    } catch (cause) { messageApi.error(cause instanceof Error ? cause.message : 'Không thể từ chối đơn'); }
    finally { setAccepting(null); }
  };
  const invite = async () => {
    if (!active || !selected || inviting) return;
    setInviting(true);
    try {
      await api('/api/shifts/' + encodeURIComponent(selected) + '/invitations', { method: 'POST', body: JSON.stringify({ student_id: active.id }) });
      setApplications(await api<Application[]>('/api/shifts/' + encodeURIComponent(selected) + '/applications'));
      messageApi.success('Đã gửi lời mời cho sinh viên');
    } catch (cause) { messageApi.error(cause instanceof Error ? cause.message : 'Không thể gửi lời mời'); }
    finally { setInviting(false); }
  };
  const chooseShift = (id: string) => { setSelected(id); setRows(null); setApplications(null); setFilter('all'); router.replace('/candidates?shift_id=' + encodeURIComponent(id)); };
  return <AppShell>{contextHolder}<div className="role-page employer-page">
    <div className="role-heading"><div><span className="eyebrow">THUẬT TOÁN KHỚP LỆNH EDUMATCH</span><h1>Ứng viên phù hợp</h1><p>EduShift tìm sinh viên có lịch rảnh và kỹ năng phù hợp với ca của bạn.</p></div></div>
    {error && <Alert type="error" title={error} style={{ marginBottom: 20 }} />}
    {!shifts ? (error ? null : <Skeleton active />) : !shifts.length ? <Empty description="Đăng ca làm việc để xem ứng viên phù hợp" /> : <>
      <div className="panel candidate-context"><div><label>ĐANG CHỌN CA TUYỂN DỤNG<Select aria-label="Chọn ca làm việc" value={selected || undefined} onChange={chooseShift} options={shifts.map(shift => ({ value: shift.id, label: shift.title + ' · ' + new Date(shift.start_time).toLocaleDateString('vi-VN') }))} /></label></div><div className="candidate-context-stats"><div><strong>{rows?.length ?? '…'}</strong><small>Sẵn sàng</small></div><div><strong>{rows?.filter(row => row.match_score >= 90).length ?? '…'}</strong><small>Khớp ≥90%</small></div></div></div>
      <section className="panel applications-panel"><div className="panel-heading"><div><h2>Đơn và lời mời</h2><p>Chấp nhận để ca làm tự xuất hiện trong lịch của sinh viên.</p></div></div><div className="application-rows">{applications === null ? <Skeleton active paragraph={{ rows: 2 }} /> : applications.length ? applications.map(item => <div className="application-row" key={item.id}><div><b>{item.name}</b><small>{item.university || 'Sinh viên EduShift'} · Match {item.match_score}%</small></div><Tag color={item.status === 'ACCEPTED' ? 'green' : item.status === 'PENDING' ? 'orange' : item.status === 'INVITED' ? 'blue' : 'default'}>{({ ACCEPTED: 'Đã nhận', PENDING: 'Chờ duyệt', INVITED: 'Đã mời', REJECTED: 'Từ chối', DECLINED: 'Không nhận lời' } as Record<Application['status'], string>)[item.status]}</Tag>{item.status === 'PENDING' && <><Button type="primary" loading={accepting === item.id} disabled={Boolean(accepting)} onClick={() => void accept(item)}>Chấp nhận</Button><Button loading={accepting === item.id} disabled={Boolean(accepting)} onClick={() => void reject(item)}>Từ chối</Button></>}</div>) : <Empty description="Chưa có đơn hoặc lời mời cho ca này" />}</div></section>
      {!rows ? <Skeleton active /> : <><div className="candidate-filter"><button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Tất cả ứng viên <b>{rows.length}</b></button><button className={filter === 'high' ? 'active' : ''} onClick={() => setFilter('high')}>Match cao <b>{rows.filter(row => row.match_score >= 90).length}</b></button></div>
      <div className="candidate-layout"><div className="candidate-cards">{visible.length ? visible.map(candidate => <button type="button" className={'candidate-list-item' + (active?.id === candidate.id ? ' active' : '')} key={candidate.id} onClick={() => setCandidateId(candidate.id)}><div className="candidate-main"><span className="avatar large"><UserOutlined /></span><div><h2>{candidate.name}</h2><p>{candidate.university || 'Chưa cập nhật trường'}{candidate.major ? ' · ' + candidate.major : ''}</p></div><strong className="score">{candidate.match_score}%<small>Match Score</small></strong></div><div className="match-reasons">{candidate.match_reasons.map(reason => <span key={reason}><CheckCircleOutlined /> {reason}</span>)}</div><div className="job-tags">{candidate.skills.map(skill => <Tag key={skill}>{skill}</Tag>)}</div></button>) : <Empty description={filter === 'high' ? 'Không có ứng viên đạt 90% trở lên' : 'Chưa có ứng viên phù hợp với ca này'} />}</div>
      {active && <aside className="panel candidate-detail"><h2>Hồ sơ ứng viên</h2><p>{active.name}</p><div className="detail-score">{active.match_score}% phù hợp</div><p>{active.university || 'Chưa cập nhật trường'}{active.major ? ' · ' + active.major : ''}</p><h3>Lý do phù hợp</h3><div className="match-reasons">{active.match_reasons.map(reason => <span key={reason}><CheckCircleOutlined /> {reason}</span>)}</div><h3>Kỹ năng</h3><div className="job-tags">{active.skills.length ? active.skills.map(skill => <Tag key={skill}>{skill}</Tag>) : <p>Chưa cập nhật kỹ năng</p>}</div>{!applications?.some(item => item.student_id === active.id) && <Button type="primary" loading={inviting} disabled={inviting} onClick={() => void invite()}>Mời nhận ca</Button>}</aside>}
      </div></>}
    </>}
  </div></AppShell>;
}
