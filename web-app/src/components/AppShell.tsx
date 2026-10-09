'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppstoreOutlined, BellOutlined, CalendarOutlined, DashboardOutlined, DownOutlined, LogoutOutlined, MenuOutlined, SearchOutlined, TeamOutlined, UnorderedListOutlined, UserOutlined } from '@ant-design/icons';
import { Avatar, Badge, Button, Divider, Drawer, Popover } from 'antd';
import { api } from '@/lib/api';

type Role = 'STUDENT' | 'EMPLOYER' | 'ADMIN';
type User = { role: Role; username?: string; email?: string; avatar_data?: string | null; profile?: { full_name?: string; company_name?: string } };
type Notification = { id: string; title: string; body: string; kind: string; is_read: boolean; created_at: string };
const navigation = {
  STUDENT: [
    { href: '/student', label: 'Tổng quan', icon: <DashboardOutlined /> },
    { href: '/student/shifts', label: 'Tìm ca làm', icon: <SearchOutlined /> },
    { href: '/student/schedule', label: 'Lịch học', icon: <CalendarOutlined /> },
  ],
  EMPLOYER: [
    { href: '/dashboard', label: 'Tổng quan', icon: <DashboardOutlined /> },
    { href: '/shifts', label: 'Ca làm việc', icon: <CalendarOutlined /> },
    { href: '/candidates', label: 'Ứng viên', icon: <TeamOutlined /> },
  ],
  ADMIN: [
    { href: '/admin', label: 'Điều hành', icon: <AppstoreOutlined /> },
    { href: '/admin/users', label: 'Tài khoản', icon: <UserOutlined /> },
    { href: '/admin/shifts', label: 'Ca làm việc', icon: <UnorderedListOutlined /> },
  ],
};
const home = { STUDENT: '/student', EMPLOYER: '/dashboard', ADMIN: '/admin' };
function notificationTime(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }); }
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname(); const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  useEffect(() => {
    const refreshUser = () => {
      try { setUser(JSON.parse(localStorage.getItem('user') || 'null')); } catch { setUser(null); }
    };
    const timer = window.setTimeout(() => {
      refreshUser();
      api<Notification[]>('/api/notifications').then(setNotifications).catch(() => setNotifications([]));
    }, 0);
    window.addEventListener('edushift-account-updated', refreshUser);
    window.addEventListener('storage', refreshUser);
    return () => { window.clearTimeout(timer); window.removeEventListener('edushift-account-updated', refreshUser); window.removeEventListener('storage', refreshUser); };
  }, []);
  const role: Role = user?.role || 'STUDENT';
  const name = user?.profile?.full_name || user?.profile?.company_name || user?.username || user?.email || 'Tài khoản';
  const initials = name.split(/\s+/).map(part => part[0]).join('').slice(-2).toUpperCase();
  const unread = notifications.filter(item => !item.is_read).length;
  const logout = () => { setMobileMenuOpen(false); localStorage.removeItem('user'); router.replace('/login'); };
  const isActive = (href: string) => pathname === href || (href === '/shifts' && pathname === '/shifts/new');
  const markRead = async () => {
    try { await api('/api/notifications/read-all', { method: 'PATCH' }); setNotifications(items => items.map(item => ({ ...item, is_read: true }))); } catch { /* Keep actual state on API error. */ }
  };
  const notificationPanel = <div className="notification-popover">
    <div className="notification-popover-head"><div><strong>Thông báo</strong><Badge count={unread} /></div><Button type="link" size="small" onClick={markRead}>Đánh dấu tất cả đã đọc</Button></div>
    <Divider />
    <div className="notification-popover-list">{notifications.length ? notifications.slice(0, 4).map(item => <div className={'notification-popover-item ' + (!item.is_read ? 'unread' : '')} key={item.id}><span className="notification-popover-icon pink"><BellOutlined /></span><div><b>{item.title}</b><p>{item.body}</p><small>{notificationTime(item.created_at)}</small></div>{!item.is_read && <i />}</div>) : <p className="empty-note">Chưa có thông báo mới.</p>}</div>
    <Divider /><Link href="/notifications" className="notification-popover-footer">Xem tất cả thông báo</Link>
  </div>;
  const accountPanel = <div className="account-popover">
    <div className="account-popover-head"><Avatar size={42} src={user?.avatar_data || undefined} style={{ backgroundColor: '#FFE0EA', color: '#B10E6B', fontWeight: 700 }}>{initials}</Avatar><div><strong>{name}</strong><small>{user?.email || user?.username || 'Tài khoản EduShift'}</small></div></div>
    <Link href="/profile" className="account-popover-link"><UserOutlined /> Hồ sơ cá nhân</Link>
    <button type="button" className="account-popover-logout" onClick={logout}><LogoutOutlined /> Đăng xuất</button>
  </div>;
  return <div className={'product-shell role-' + role.toLowerCase()}>
    {role === 'EMPLOYER' && <aside className="employer-sidebar">
      <Link href="/dashboard" className="brand employer-sidebar-brand" aria-label="EduShift"><span className="mark">E</span><span className="brand-name">Edu<span>Shift</span><small>BUSINESS PORTAL</small></span></Link>
      <nav className="employer-sidebar-nav" aria-label="Điều hướng doanh nghiệp">{navigation.EMPLOYER.map(link => <Link key={link.href} className={isActive(link.href) ? 'active' : ''} aria-current={isActive(link.href) ? 'page' : undefined} href={link.href}><span>{link.icon}</span>{link.label}</Link>)}</nav>
    </aside>}
    <header className="product-topbar">
      <Button type="text" className="mobile-menu-button" icon={<MenuOutlined />} aria-label="Mở menu điều hướng" aria-expanded={mobileMenuOpen} aria-controls="mobile-product-navigation" onClick={() => setMobileMenuOpen(true)} />
      <Link href={home[role]} className="brand" aria-label="EduShift"><span className="mark">E</span><span className="brand-name">Edu<span>Shift</span></span></Link>
      <span className="workspace-label">{role === 'STUDENT' ? 'Không gian sinh viên' : role === 'ADMIN' ? 'Bảng điều hành' : 'Không gian doanh nghiệp'}</span>
      <nav className="product-nav" aria-label="Điều hướng chính">{navigation[role].map(link => <Link key={link.href} className={isActive(link.href) ? 'active' : ''} aria-current={isActive(link.href) ? 'page' : undefined} href={link.href}><span>{link.icon}</span>{link.label}</Link>)}</nav>
      <div className="product-actions">
        <Popover trigger="click" placement="bottomRight" arrow={false} content={notificationPanel}><Button type="text" className="notification-button" aria-label="Thông báo"><Badge count={unread} size="small"><BellOutlined /></Badge></Button></Popover>
        <Popover trigger={['hover', 'click']} placement="bottomRight" arrow={false} content={accountPanel}><button type="button" className="user-chip account-trigger" aria-label="Mở menu tài khoản" aria-haspopup="true"><Avatar size={36} src={user?.avatar_data || undefined} style={{ backgroundColor: '#FFE0EA', color: '#B10E6B', fontWeight: 700 }}>{initials}</Avatar><span className="account-trigger-text"><b>{name}</b><small>{role === 'ADMIN' ? 'Quản trị viên' : role === 'STUDENT' ? 'Sinh viên' : 'Doanh nghiệp'}</small></span><DownOutlined className="account-chevron" /></button></Popover>
      </div>
    </header>
    <Drawer className="product-mobile-drawer" title={<Link href={home[role]} className="brand" onClick={() => setMobileMenuOpen(false)}><span className="mark">E</span><span className="brand-name">Edu<span>Shift</span></span></Link>} placement="left" width="min(320px, 88vw)" open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)}>
      <span className="mobile-menu-caption">{role === 'STUDENT' ? 'Không gian sinh viên' : role === 'ADMIN' ? 'Bảng điều hành' : 'Không gian doanh nghiệp'}</span>
      <nav id="mobile-product-navigation" className="mobile-product-nav" aria-label="Điều hướng mobile">{navigation[role].map(link => <Link key={link.href} href={link.href} className={isActive(link.href) ? 'active' : ''} aria-current={isActive(link.href) ? 'page' : undefined} onClick={() => setMobileMenuOpen(false)}><span>{link.icon}</span>{link.label}</Link>)}<Link href="/notifications" className={pathname === '/notifications' ? 'active' : ''} aria-current={pathname === '/notifications' ? 'page' : undefined} onClick={() => setMobileMenuOpen(false)}><span><BellOutlined /></span>Thông báo{unread > 0 && <Badge count={unread} size="small" />}</Link><Link href="/profile" className={pathname === '/profile' ? 'active' : ''} aria-current={pathname === '/profile' ? 'page' : undefined} onClick={() => setMobileMenuOpen(false)}><span><UserOutlined /></span>Hồ sơ cá nhân</Link></nav>
      <button className="mobile-menu-logout" type="button" onClick={logout}><LogoutOutlined /> Đăng xuất</button>
    </Drawer>
    <main className="product-content">{children}</main>
  </div>;
}
