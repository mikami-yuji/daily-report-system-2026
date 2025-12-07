import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from 'react-hot-toast';
import AppLayout from "@/components/AppLayout";
import { FileProvider } from "@/context/FileContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "営業日報システム",
  description: "営業日報・活動管理システム",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "営業日報",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport = {
  themeColor: "#0066CC",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body className="antialiased bg-sf-bg text-sf-text h-screen overflow-hidden" suppressHydrationWarning>
        <Toaster position="top-right" />
        <FileProvider>
          <AppLayout>
            {children}
          </AppLayout>
        </FileProvider>
      </body>
    </html>
  );
}
