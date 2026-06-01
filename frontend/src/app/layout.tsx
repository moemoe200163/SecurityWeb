import type { Metadata } from "next";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Providers } from "@/components/layout/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "安全智能體 AI 對話系統",
  description: "SOC 告警分析、威脅情報調查、滲透測試輔助",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW" className="h-full antialiased">
      <body className="h-full">
        <TooltipProvider>
          <Providers>{children}</Providers>
        </TooltipProvider>
      </body>
    </html>
  );
}
