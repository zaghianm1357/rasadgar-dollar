import { NextResponse } from "next/server";
import { getMarketStructure } from "@/lib/market-structure";
import type { MarketStructureResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const force = new URL(req.url).searchParams.get("force") === "1";
    const data: MarketStructureResponse = await getMarketStructure(force);
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[api/market-structure] fatal:", err);
    return NextResponse.json(
      { error: "خطا در تحلیل ساختار بازار. لطفاً دوباره تلاش کنید." },
      { status: 500 }
    );
  }
}
