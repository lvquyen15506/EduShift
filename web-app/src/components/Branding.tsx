'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { API_URL } from '@/lib/api';
import { brandText, DEFAULT_NAME, type PublicBrandSettings } from '@/lib/branding';

const DEFAULT_LOGO = '/brand-logo.jpg';
const BRAND_EVENT = 'edushift-brand-updated';
const BRAND_STORAGE_KEY = 'edushift-brand-updated-at';
const BrandingContext = createContext({ logo: DEFAULT_LOGO, name: DEFAULT_NAME });

function logoSource(value?: string) {
  const source = value?.trim();
  return source && /^(?:https?:\/\/|\/(?!\/)|data:image\/(?:jpeg|png|webp|svg\+xml);base64,)/i.test(source)
    ? source
    : DEFAULT_LOGO;
}

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [brand, setBrand] = useState({ logo: DEFAULT_LOGO, ...brandText({}) });

  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      try {
        const response = await fetch(`${API_URL}/api/public/settings`, { cache: 'no-store' });
        if (!response.ok) return;
        const settings = await response.json() as PublicBrandSettings;
        if (mounted) setBrand({ logo: logoSource(settings.brand_logo_url), ...brandText(settings) });
      } catch { /* The bundled logo remains available when the API is offline. */ }
    };
    const onUpdated = (event: Event) => {
      const value = (event as CustomEvent<string>).detail;
      if (typeof value === 'string') setBrand(current => ({ ...current, logo: logoSource(value) }));
      void refresh();
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === BRAND_STORAGE_KEY) void refresh();
    };
    void refresh();
    window.addEventListener(BRAND_EVENT, onUpdated);
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', refresh);
    return () => {
      mounted = false;
      window.removeEventListener(BRAND_EVENT, onUpdated);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  useEffect(() => {
    const icons = document.querySelectorAll<HTMLLinkElement>('link[rel="icon"]');
    icons.forEach(icon => { icon.href = brand.logo; });
    document.title = brand.title;
  }, [brand.logo, brand.title, pathname]);

  return <BrandingContext.Provider value={{ logo: brand.logo, name: brand.name }}>{children}</BrandingContext.Provider>;
}

export function BrandLogo({ className = '' }: { className?: string }) {
  const { logo, name } = useContext(BrandingContext);
  // Admin supplied data URLs need to be rendered directly without Next image optimization.
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={`brand-image ${className}`.trim()} src={logo} alt={'Logo ' + name} title={name} />;
}

export function publishBrandSettings(value?: string) {
  window.dispatchEvent(new CustomEvent(BRAND_EVENT, { detail: value }));
  try { localStorage.setItem(BRAND_STORAGE_KEY, String(Date.now())); }
  catch { /* The active tab has already been updated. */ }
}
