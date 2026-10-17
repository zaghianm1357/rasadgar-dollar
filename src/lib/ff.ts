import crypto from "crypto";
import { db } from "@/lib/db";
import { todayKeyInTehran } from "@/lib/tehran";

const FEED_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";
const FEED_TTL_MS = 30 * 60 * 1000; // حداکثر هر ۳۰ دقیقه فید تازه گرفته می‌شود
const FAIL_BACKOFF_MS = 5 * 60 * 1000; // بعد از خطا ۵ دقیقه صبر

export interface FeedResult {
  status: "live" | "cached" | "error";
  count: number;
}

interface RawEvent {
  title?: string;
  country?: string;
  date?: string;
  impact?: string;
  forecast?: string;
  previous?: string;
  actual?: string;
}

export async function getMeta(key: string): Promise<string | null> {
  const row = await db.appMeta.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function setMeta(key: string, value: string): Promise<void> {
  await db.appMeta.upsert({ where: { key }, update: { value }, create: { key, value } });
}

// قفل ساده برای جلوگیری از درخواست همزمان چند ریکوئست به فید
const feedLock: { current: Promise<unknown> } = { current: Promise.resolve() };

function runExclusive<T>(lock: { current: Promise<unknown> }, fn: () => Promise<T>): Promise<T> {
  const p = lock.current.then(fn, fn);
  lock.current = p.catch(() => undefined);
  return p;
}

function normalizeImpact(v?: string): string {
  const s = (v || "").toLowerCase().trim();
  if (s === "high") return "High";
  if (s === "medium") return "Medium";
  if (s === "low") return "Low";
  if (s === "holiday") return "Holiday";
  return "Low";
}

// لنگر هفته (یکشنبه) برای رویدادهای بدون تاریخ
function weekAnchorKey(now: Date = new Date()): string {
  const key = todayKeyInTehran(now);
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - dt.getUTCDay()); // 0 = Sunday
  return dt.toISOString().slice(0, 10);
}

/**
 * فید هفتگی ForexFactory را در صورت نیاز می‌گیرد و رویدادهای USD را در دیتابیس ذخیره می‌کند.
 * در صورت خطا (مثلاً Rate Limit) از داده‌های قبلی موجود در دیتابیس استفاده می‌شود.
 */
export async function refreshFeed(): Promise<FeedResult> {
  return runExclusive(feedLock, async () => {
    const lastOk = Number((await getMeta("ff_feed_last_ok")) || 0);
    const lastFail = Number((await getMeta("ff_feed_last_fail")) || 0);
    const now = Date.now();

    if (now - lastOk < FEED_TTL_MS) return { status: "cached", count: 0 };
    if (now - lastFail < FAIL_BACKOFF_MS) return { status: "cached", count: 0 };

    try {
      const res = await fetch(FEED_URL, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept: "application/json,text/plain,*/*",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(25000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const text = await res.text();
      const trimmed = text.trim();
      if (!trimmed.startsWith("[")) {
        // پاسخ Rate Limit به صورت HTML برمی‌گردد
        throw new Error("Non-JSON response (probably rate limited)");
      }

      const raw = JSON.parse(trimmed) as RawEvent[];
      const usd = raw.filter((e) => (e.country || "").toUpperCase() === "USD");
      const anchor = weekAnchorKey();

      for (const e of usd) {
        if (!e.title) continue;
        const hasDate = !!(e.date && e.date.trim());
        const parsed = hasDate ? new Date(e.date!.trim()) : null;
        const dateISO = parsed && !isNaN(parsed.getTime()) ? parsed.toISOString() : null;
        const validDate = dateISO ? new Date(dateISO) : null;

        const keySrc = `${e.country}|${e.title.trim()}|${dateISO || `allday:${anchor}`}`;
        const eventKey = crypto.createHash("md5").update(keySrc).digest("hex");

        const data = {
          title: e.title.trim(),
          country: "USD",
          date: validDate,
          allDay: !validDate,
          impact: normalizeImpact(e.impact),
          forecast: e.forecast?.trim() || null,
          previous: e.previous?.trim() || null,
          actual: e.actual?.trim() || null,
        };

        await db.economicEvent.upsert({
          where: { eventKey },
          update: data,
          create: { eventKey, ...data },
        });
      }

      await setMeta("ff_feed_last_ok", String(now));

      // پاکسازی رویدادهای قدیمی‌تر از ۱۰ روز
      const cutoff = new Date(now - 10 * 24 * 60 * 60 * 1000);
      await db.economicEvent.deleteMany({ where: { date: { lt: cutoff } } });

      return { status: "live", count: usd.length };
    } catch (err) {
      console.error("[ff] feed fetch failed:", (err as Error).message);
      await setMeta("ff_feed_last_fail", String(now));
      return { status: "error", count: 0 };
    }
  });
}
