import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "بیگ تردر | رصدگر دلار — دستیار هوشمند معامله‌گری طلا و دلار",
  description:
    "پایش زندهٔ طلا و داوجونز با ساختار بازار در شش تایم‌فریم، دماسنج فشار خرید و فروش تریدینگ‌ویو، تقویم اقتصادی فارسی ForexFactory و تحلیل و پیش‌بینی روزانهٔ طلا (LiteFinance و FXStreet) — نسخهٔ وب، فایل مستقل و افزونهٔ وردپرس.",
  keywords: ["دلار", "فارکس", "ForexFactory", "اخبار اقتصادی", "تقویم اقتصادی", "طلا", "XAUUSD", "بیگ تردر", "BIG TRADER"],
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
      <body className="antialiased bg-background text-foreground min-h-screen">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
