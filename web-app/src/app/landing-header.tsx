'use client';
import { useState } from 'react';
import Link from 'next/link';
import { BrandLogo } from '@/components/Branding';

const sections = [
  { href: '#loi-ich', label: 'Lợi ích' },
  { href: '#cach-hoat-dong', label: 'Cách hoạt động' },
  { href: '#doanh-nghiep', label: 'Doanh nghiệp' },
  { href: '#bang-gia', label: 'Bảng giá' },
];

export default function LandingHeader() {
  const [open, setOpen] = useState(false);
  return <header className="landing-header">
    <Link href="/" className="landing-brand" aria-label="EduShift - Trang chủ" onClick={() => setOpen(false)}><BrandLogo /></Link>
    <nav className="landing-desktop-nav" aria-label="Điều hướng chính">{sections.map(item => <a key={item.href} href={item.href}>{item.label}</a>)}</nav>
    <div className="landing-head-actions"><Link href="/login">Đăng nhập</Link><Link href="/register" className="landing-button landing-button-small">Bắt đầu ngay <span aria-hidden="true">↗</span></Link></div>
    <button className="landing-menu-toggle" type="button" aria-label={open ? 'Đóng menu' : 'Mở menu'} aria-controls="landing-mobile-nav" aria-expanded={open} onClick={() => setOpen(value => !value)}><span aria-hidden="true">{open ? '×' : '☰'}</span></button>
    <nav id="landing-mobile-nav" className="landing-mobile-nav" aria-label="Điều hướng trên điện thoại" hidden={!open} onKeyDown={event => { if (event.key === 'Escape') setOpen(false); }}>{sections.map(item => <a key={item.href} href={item.href} onClick={() => setOpen(false)}>{item.label}</a>)}<Link href="/login" onClick={() => setOpen(false)}>Đăng nhập</Link><Link href="/register" onClick={() => setOpen(false)}>Tạo tài khoản</Link></nav>
  </header>;
}
