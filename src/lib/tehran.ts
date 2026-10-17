// کمک‌توابع تاریخ و زمان بر مبنای منطقه زمانی تهران (ایران از ۱۴۰۱ ساعت تابستانی ندارد)
const TEHRAN_TZ = "Asia/Tehran";
const TEHRAN_OFFSET_MIN = 210; // UTC+3:30

const gregorianKeyFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TEHRAN_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// کلید میلادی YYYY-MM-DD بر اساس تاریخ تهران
export function dateKeyInTehran(d: Date): string {
  return gregorianKeyFmt.format(d);
}

export function todayKeyInTehran(now: Date = new Date()): string {
  return dateKeyInTehran(now);
}

export function addDaysToKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

// لحظه مطلق شروع یک روز تقویمی در تهران
export function tehranDayStart(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - TEHRAN_OFFSET_MIN * 60 * 1000);
}

export function tehranDayEnd(key: string): Date {
  return new Date(tehranDayStart(key).getTime() + 24 * 60 * 60 * 1000);
}

// تاریخ شمسی بلند: «پنجشنبه ۲۶ مهر»
export function faDateLong(d: Date): string {
  return new Intl.DateTimeFormat("fa-IR", {
    timeZone: TEHRAN_TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
}

// تاریخ شمسی کوتاه: «۲۶ مهر»
export function faDateShort(d: Date): string {
  return new Intl.DateTimeFormat("fa-IR", {
    timeZone: TEHRAN_TZ,
    day: "numeric",
    month: "long",
  }).format(d);
}

// ساعت HH:MM به وقت تهران با ارقام فارسی
export function faTime(d: Date): string {
  return new Intl.DateTimeFormat("fa-IR", {
    timeZone: TEHRAN_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

// ساعت زنده با ثانیه برای هدر
export function faClock(d: Date): string {
  return new Intl.DateTimeFormat("fa-IR", {
    timeZone: TEHRAN_TZ,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(d);
}

// تبدیل ارقام لاتین به فارسی + ممیز و درصد فارسی
const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
export function faDigits(input: string | number | null | undefined): string {
  if (input === null || input === undefined || input === "") return "—";
  return String(input)
    .replace(/[0-9]/g, (ch) => FA_DIGITS[Number(ch)])
    .replace(/(\d)\.(\d)/g, "$1٫$2")
    .replace(/%/g, "٪");
}
