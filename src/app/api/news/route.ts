import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { refreshFeed, getMeta, MAJOR_CURRENCIES } from "@/lib/ff";
import { translatePendingEvents, ensureDailyDigest } from "@/lib/translate";
import { dateKeyInTehran, todayKeyInTehran, tehranDayStart, addDaysToKey } from "@/lib/tehran";
import type { AssetOutlook, Direction, Impact, NewsEvent, NewsResponse } from "@/lib/types";
import type { EconomicEvent } from "@prisma/client";

export const dynamic = "force-dynamic";

function parseDir(v: string | null): Direction | null {
  return ["bullish", "bearish", "mixed", "neutral"].includes(v || "") ? (v as Direction) : null;
}

/** استخراج اولین عدد از رشته‌هایی مثل "0.3%" ، "220K" ، "-169.8B" */
function parseNum(s: string | null): number | null {
  if (!s) return null;
  const m = s.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = parseFloat(m[0]);
  return isNaN(n) ? null : n;
}

/**
 * برآورد احتمال افزایش/کاهش طلا و داو بر اساس مقایسه forecast با previous.
 * گام اول: احتمال سناریوی «بالاتر از انتظار» از فاصله پیش‌بینی تا مقدار قبلی.
 * گام دوم: ترکیب با جهت تأثیر هر نماد در هر سناریو (mixed/neutral = 50/50).
 */
function computeOutlook(e: EconomicEvent): AssetOutlook | null {
  const f = parseNum(e.forecast);
  const p = parseNum(e.previous);
  const dirs = [e.xauAbove, e.xauBelow, e.djiAbove, e.djiBelow];
  if (f === null || p === null || !dirs.some((d) => d)) return null;

  const pPrev = Math.abs(p) > 1e-9 ? Math.abs(p) : 1e-9;
  const deltaPct = Math.min(1, Math.abs(f - p) / pPrev);
  // انحراف از 50/50: حداقل 10 واحد، حداکثر 25 واحد (سقف 75/25 برای خوش‌بینی مسئولانه)
  const tilt = Math.min(0.25, 0.1 + deltaPct * 1.5);

  let pAbove: number;
  let cmp: "above" | "below" | "equal";
  if (f > p) {
    pAbove = 0.5 + tilt;
    cmp = "above";
  } else if (f < p) {
    pAbove = 0.5 - tilt;
    cmp = "below";
  } else {
    pAbove = 0.5;
    cmp = "equal";
  }
  const pBelow = 1 - pAbove;

  const upProb = (aboveDir: string | null, belowDir: string | null): number => {
    const upIfAbove = aboveDir === "bullish" ? 1 : aboveDir === "bearish" ? 0 : 0.5;
    const upIfBelow = belowDir === "bullish" ? 1 : belowDir === "bearish" ? 0 : 0.5;
    const raw = pAbove * upIfAbove + pBelow * upIfBelow;
    // رُند به نزدیک‌ترین ۵ درصد
    return Math.round(raw * 20) / 20;
  };

  return {
    pAbove: Math.round(pAbove * 20) / 20,
    xauUp: upProb(e.xauAbove, e.xauBelow),
    djiUp: upProb(e.djiAbove, e.djiBelow),
    cmp,
  };
}

function serialize(e: EconomicEvent): NewsEvent {
  return {
    id: e.eventKey,
    title: e.title,
    titleFa: e.titleFa,
    country: e.country || "USD",
    dateISO: e.date ? e.date.toISOString() : null,
    allDay: e.allDay || !e.date,
    impact: (["High", "Medium", "Low", "Holiday"].includes(e.impact) ? e.impact : "Low") as Impact,
    forecast: e.forecast,
    previous: e.previous,
    actual: e.actual,
    direction: parseDir(e.direction),
    explanationFa: e.explanationFa,
    xauAbove: parseDir(e.xauAbove),
    xauBelow: parseDir(e.xauBelow),
    djiAbove: parseDir(e.djiAbove),
    djiBelow: parseDir(e.djiBelow),
    outlook: computeOutlook(e),
  };
}

export async function GET() {
  try {
    // ۱) در صورت نیاز فید را تازه کنیم (خطا غیرمرگبار است)
    const feed = await refreshFeed();

    // ۲) ترجمه/تحلیل رویدادهای ناقص (مهم‌ترین‌ها اول)
    let translatedNow = 0;
    try {
      translatedNow = await translatePendingEvents(32, 8);
    } catch (err) {
      console.error("[api/news] translate error:", (err as Error).message);
    }

    // ۳) خواندن نهایی رویدادهای مرتبط — USD به‌همراه رویدادهای پراهمیت ارزهای اصلی
    const all = await db.economicEvent.findMany({
      where: { country: { in: [...MAJOR_CURRENCIES] } },
      orderBy: [{ date: "asc" }],
    });

    // ۴) محدوده نمایش: از ۵ روز قبل تا ۸ روز بعد (به وقت تهران) — تا شنبه‌ها هم تاریخ هفته قابل مرور باشد
    const todayKey = todayKeyInTehran();
    const fromTs = tehranDayStart(addDaysToKey(todayKey, -5)).getTime();
    const toTs = tehranDayStart(addDaysToKey(todayKey, 8)).getTime();
    const ranged = all.filter((e) => {
      if (!e.date) return true; // رویدادهای هم‌روز
      const t = e.date.getTime();
      return t >= fromTs && t < toTs;
    });

    // ۵) خلاصه روزانه هوشمند برای امروز
    const todayEvents = ranged.filter(
      (e) =>
        e.date &&
        dateKeyInTehran(e.date) === todayKey &&
        (e.impact === "High" || e.impact === "Medium")
    );
    let digest: string | null = null;
    try {
      digest = await ensureDailyDigest(todayKey, todayEvents);
    } catch (err) {
      console.error("[api/news] digest error:", (err as Error).message);
    }

    const lastFetch = await getMeta("ff_feed_last_ok");
    const pendingTranslation = ranged.filter((e) => !e.titleFa || !e.xauAbove).length;

    const payload: NewsResponse = {
      feedStatus: feed.status,
      lastFetchISO: lastFetch ? new Date(Number(lastFetch)).toISOString() : null,
      digest,
      translatedNow,
      pendingTranslation,
      events: ranged.map(serialize),
    };

    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[api/news] fatal:", err);
    return NextResponse.json(
      { error: "خطا در دریافت اخبار. لطفاً دوباره تلاش کنید." },
      { status: 500 }
    );
  }
}
