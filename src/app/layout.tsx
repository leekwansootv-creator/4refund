import type { Metadata } from "next";
import { Geist_Mono, Noto_Sans_KR } from "next/font/google";

import { LANDING_ASSETS } from "@/features/landing-page";

import "./globals.css";

const notoSansKr = Noto_Sans_KR({
  variable: "--font-noto-sans-kr",
  weight: "variable",
  preload: false,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "4대보험경정청구센터",
  description: "전문 노무사가 4대보험 과오납 환급 가능성을 진단하고 경정청구 절차를 지원합니다.",
  icons: {
    icon: {
      url: LANDING_ASSETS.icons.favicon,
      type: "image/svg+xml",
      sizes: "any",
    },
  },
};

/**
 * 모든 라우트에 공통으로 적용할 문서 언어, 글꼴, 레이아웃 경계를 정의한다.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${notoSansKr.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
