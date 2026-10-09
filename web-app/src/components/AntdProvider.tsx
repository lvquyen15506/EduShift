'use client';

import { ConfigProvider } from 'antd';

export default function AntdProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider theme={{ token: { colorPrimary: '#B10E6B', colorInfo: '#B10E6B', colorSuccess: '#006C49', colorWarning: '#B10E6B', colorError: '#BA1A1A', colorText: '#25181D', colorTextSecondary: '#574048', colorBgLayout: '#FFF8F8', colorBorder: '#F1DFE5', borderRadius: 8, fontFamily: 'var(--font-geist-sans), Inter, Arial, sans-serif' }, components: { Button: { controlHeight: 36, fontWeight: 650 }, Card: { borderRadiusLG: 14 }, Tag: { borderRadiusSM: 6 } } }}>
      {children}
    </ConfigProvider>
  );
}
