import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./landing.css";
import AntdProvider from "@/components/AntdProvider";
import AuthGuard from "@/components/AuthGuard";
const geistSans = Geist({variable:"--font-geist-sans",subsets:["latin"]});
const geistMono = Geist_Mono({variable:"--font-geist-mono",subsets:["latin"]});
export const metadata: Metadata = { metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"), title: { default: "EduShift · Đúng người, đúng ca", template: "%s · EduShift" }, description: "Nền tảng kết nối việc làm part-time theo lịch học", keywords: ["việc làm part-time", "việc làm sinh viên", "ca làm", "EduShift"], openGraph: { type: "website", siteName: "EduShift", locale: "vi_VN", title: "EduShift · Đúng người, đúng ca", description: "Nền tảng kết nối việc làm part-time theo lịch học" }, twitter: { card: "summary_large_image", title: "EduShift · Đúng người, đúng ca", description: "Nền tảng kết nối việc làm part-time theo lịch học" }, robots: { index: true, follow: true } };
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>){return <html lang="vi" className={geistSans.variable+" "+geistMono.variable}><body><AntdProvider><AuthGuard>{children}</AuthGuard></AntdProvider></body></html>}
