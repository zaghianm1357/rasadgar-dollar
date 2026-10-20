const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

/** Convert latin digits inside a string to Persian digits */
export function fa(input: string | number): string {
  return String(input).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}

export function fmtPrice(value: number, decimals = 2): string {
  const s = value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return fa(s);
}

export function fmtInt(value: number): string {
  return fa(Math.round(value).toLocaleString("en-US"));
}

export function fmtPct(value: number, decimals = 2): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${fa(Math.abs(value).toFixed(decimals))}٪`;
}

export function fmtSigned(value: number, decimals = 2): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${fa(Math.abs(value).toFixed(decimals))}`;
}

const timeFmt = new Intl.DateTimeFormat("fa-IR", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Tehran",
});

const fullDateFmt = new Intl.DateTimeFormat("fa-IR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "Asia/Tehran",
});

const shortDateFmt = new Intl.DateTimeFormat("fa-IR", {
  day: "numeric",
  month: "long",
  timeZone: "Asia/Tehran",
});

export function fmtTime(ts: number): string {
  return timeFmt.format(new Date(ts));
}

export function fmtFullDate(ts: number): string {
  return fullDateFmt.format(new Date(ts));
}

export function fmtShortDate(ts: number): string {
  return shortDateFmt.format(new Date(ts));
}

export function fmtClock(ts: number): string {
  return new Intl.DateTimeFormat("fa-IR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Tehran",
  }).format(new Date(ts));
}

export function dayKey(ts: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran" }).format(new Date(ts));
}

export interface Countdown {
  d: number;
  h: number;
  m: number;
  s: number;
  total: number;
}

export function countdown(target: number, now: number): Countdown {
  const total = Math.max(0, target - now);
  const s = Math.floor(total / 1000);
  return {
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60,
    total,
  };
}

export function pad2(n: number): string {
  return fa(String(n).padStart(2, "0"));
}

export function timeAgo(ts: number, now: number): string {
  const diff = Math.max(0, now - ts);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "همین لحظه";
  if (mins < 60) return `${fa(mins)} دقیقه پیش`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${fa(hours)} ساعت پیش`;
  return `${fa(Math.floor(hours / 24))} روز پیش`;
}
