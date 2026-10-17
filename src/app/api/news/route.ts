import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { refreshFeed, getMeta } from "@/lib/ff";
import { translatePendingEvents, ensureDailyDigest } from "@/lib/translate";
import { dateKeyInTehran, todayKeyInTehran, tehranDayStart, addDaysToKey } from "@/lib/tehran";
import type { Direction, Impact, NewsEvent, NewsResponse } from "@/lib/types";
import type { EconomicEvent } from "@prisma/client";

export const dynamic = "force-dynamic";

function serialize(e: EconomicEvent): NewsEvent {
  return {
    id: e.eventKey,
    title: e.title,
    titleFa: e.titleFa,
    dateISO: e.date ? e.date.toISOString() : null,
    allDay: e.allDay || !e.date,
    impact: (["High", "Medium", "Low", "Holiday"].includes(e.impact) ? e.impact : "Low") as Impact,
    forecast: e.forecast,
    previous: e.previous,
    actual: e.actual,
    direction: (["bullish", "bearish", "mixed", "neutral"].includes(e.direction || "")
      ? e.direction
      : null) as Direction | null,
    explanationFa: e.explanationFa,
  };
}

export async function GET() {
  try {
    // ۱) در صورت نیاز فید را تازه کنیم (خطا غیرمرگبار است)
    const feed = await refreshFeed();

    // ۲) ترجمه رویدادهای بدون ترجمه (مهم‌ترین‌ها اول)
    let translatedNow = 0;
    try {
      translatedNow = await translatePendingEvents(32, 8);
    } catch (err) {
      console.error("[api/news] translate error:", (err as Error).message);
    }

    // ۳) خواندن نهایی رویدادهای USD
    const all = await db.economicEvent.findMany({
      where: { country: "USD" },
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
    const pendingTranslation = ranged.filter((e) => !e.titleFa).length;

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
