import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "쿨타임 · CoolTime",
  description:
    "체감온도에 따른 폭염 작업중지·휴식 의무 기준을 실시간으로 확인하고 기록하는 서비스",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="font-sans antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
