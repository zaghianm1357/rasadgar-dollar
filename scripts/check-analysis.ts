// بررسی وضعیت تحلیل نمادها در دیتابیس
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

async function main() {
  const total = await db.economicEvent.count();
  const withAnalysis = await db.economicEvent.count({ where: { xauAbove: { not: null } } });
  const missing = await db.economicEvent.count({
    where: { OR: [{ xauAbove: null }, { xauBelow: null }, { djiAbove: null }, { djiBelow: null }] },
  });
  console.log(`total=${total} withAnalysis=${withAnalysis} missing=${missing}`);

  const sample = await db.economicEvent.findMany({
    where: { impact: { in: ["High", "Medium"] } },
    orderBy: { date: "asc" },
    take: 3,
  });
  for (const e of sample) {
    console.log("•", e.titleFa?.slice(0, 40), "| impact:", e.impact);
    console.log("   xau:", e.xauAbove, "/", e.xauBelow, "| dji:", e.djiAbove, "/", e.djiBelow);
    console.log("   fc:", e.forecast, "prev:", e.previous);
  }
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
