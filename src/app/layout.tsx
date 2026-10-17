import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "رصدگر دلار | اخبار اقتصادی ForexFactory به فارسی",
  description:
    "اخبار و رویدادهای اقتصادی مهم دلار آمریکا (USD) از ForexFactory با ترجمه فارسی، تحلیل تأثیر بر نرخ دلار و بروزرسانی خودکار روزانه",
  keywords: ["دلار", "فارکس", "ForexFactory", "اخبار اقتصادی", "تقویم اقتصادی", "USD"],
};

export const viewport: Viewport = {
  themeColor: "#0d1117",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased bg-background text-foreground min-h-screen">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
