/**
 * نام فارسی ارزها برای نشان کشور روی رویدادهای تقویم اقتصادی.
 * رویدادهای غیردلاری از مسیر شاخص دلار و انتظارات نرخ بهره بر طلا و داو اثر می‌گذارند؛
 * نشان دادن کشور روی هر رویداد برای شفافیت داده الزامی است.
 */
const CURRENCY_FA: Record<string, string> = {
  USD: "دلار آمریکا",
  EUR: "یورو",
  GBP: "پوند انگلیس",
  JPY: "ین ژاپن",
  CAD: "دلار کانادا",
  AUD: "دلار استرالیا",
  NZD: "دلار نیوزیلند",
  CHF: "فرانک سوئیس",
  CNY: "یوان چین",
  ALL: "چند کشور",
};

export function currencyFa(c?: string | null): string {
  const key = (c || "").toUpperCase();
  return CURRENCY_FA[key] || key;
}
