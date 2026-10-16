import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./landing.css";
import "./branding.css";
import AntdProvider from "@/components/AntdProvider";
import AuthGuard from "@/components/AuthGuard";
import { BrandingProvider } from "@/components/Branding";
import { brandText, type PublicBrandSettings } from "@/lib/branding";
const geistSans = Geist({variable:"--font-geist-sans",subsets:["latin"]});
const geistMono = Geist_Mono({variable:"--font-geist-mono",subsets:["latin"]});
export async function generateMetadata(): Promise<Metadata> {
  let settings: PublicBrandSettings = {};
  try {
    const response = await fetch((process.env.API_PROXY_TARGET || "http://localhost:8000") + "/api/public/settings", {
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    });
    if (response.ok) settings = await response.json() as PublicBrandSettings;
  } catch { /* Use bundled brand text when the API is unavailable. */ }
  const { name, title, description } = brandText(settings);
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
    title: { default: title, template: "%s · " + name },
    description,
    keywords: ["việc làm part-time", "việc làm sinh viên", "ca làm", name],
    openGraph: { type: "website", siteName: name, locale: "vi_VN", title, description },
    twitter: { card: "summary_large_image", title, description },
    robots: { index: true, follow: true },
  };
}
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>){return <html lang="vi" className={geistSans.variable+" "+geistMono.variable}><body><BrandingProvider><AntdProvider><AuthGuard>{children}</AuthGuard></AntdProvider></BrandingProvider></body></html>}
