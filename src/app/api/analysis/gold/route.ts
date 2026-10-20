import { NextResponse } from "next/server";
import { getGoldBriefing } from "@/lib/analysis-sources";

export const dynamic = "force-dynamic";

/**
 * API تحلیل و پیش‌بینی طلا (/api/analysis/gold[?force=1])
 * جمع‌آوری خلاصه از LiteFinance (پیش‌بینی روزانه/فردا/هفتگی)، FXStreet
 * (تحلیل‌ها و نظرسنجی) و تریدینگ‌ویو (رأی فنی روزانه) + جمع‌بندی فارسی.
 * کش ۳۰ دقیقه‌ای در AppMeta؛ در قطعی کامل، آخرین نسخه سالم با برچسب کهنگی.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";
  try {
    const briefing = await getGoldBriefing(force);
    return NextResponse.json(briefing, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "خطای نامشخص در جمع‌آوری تحلیل‌ها" },
      { status: 500 }
    );
  }
}
