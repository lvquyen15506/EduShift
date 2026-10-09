import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./landing.css";
import AntdProvider from "@/components/AntdProvider";
import AuthGuard from "@/components/AuthGuard";
const geistSans = Geist({variable:"--font-geist-sans",subsets:["latin"]});
const geistMono = Geist_Mono({variable:"--font-geist-mono",subsets:["latin"]});
export const metadata: Metadata = { title:"EduShift · Đúng người, đúng ca", description:"Nền tảng kết nối việc làm part-time theo lịch học" };
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>){return <html lang="vi" className={geistSans.variable+" "+geistMono.variable}><body><AntdProvider><AuthGuard>{children}</AuthGuard></AntdProvider></body></html>}
