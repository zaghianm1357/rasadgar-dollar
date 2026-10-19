/**
 * اسکریپت تست: دستکاری اسنپ‌شات روند برای شبیه‌سازی «تغییر جهت»
 * استفاده: bun scripts/tamper-snapshot.ts
 * پاکسازی: bun scripts/tamper-snapshot.ts --restore
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SNAPSHOT_KEY = "ms_trend_snapshot_v1";
const CHANGES_KEY = "ms_trend_changes_v1";

async function main() {
  const restore = process.argv.includes("--restore");

  if (restore) {
    // پاکسازی: حذف تغییرات آزمایشی
    await prisma.appMeta.upsert({
      where: { key: CHANGES_KEY },
      update: { value: "[]" },
      create: { key: CHANGES_KEY, value: "[]" },
    });
    console.log("changes reset to []");
    return;
  }

  const row = await prisma.appMeta.findUnique({ where: { key: SNAPSHOT_KEY } });
  if (!row) throw new Error("snapshot not found — run force=1 first");
  const snap = JSON.parse(row.value) as {
    atISO: string;
    xau: Record<string, string>;
    dji: Record<string, string>;
  };

  // دستکاری: فلپ جهت‌ها (اگر مقدار خنثی/نزولی است → صعودی و برعکس)
  const flip = (t: string) => (t === "bullish" ? "bearish" : "bullish");
  snap.xau["1h"] = flip(snap.xau["1h"] ?? "bullish");
  snap.xau["4h"] = flip(snap.xau["4h"] ?? "neutral");
  snap.dji["1wk"] = flip(snap.dji["1wk"] ?? "bullish");

  await prisma.appMeta.update({
    where: { key: SNAPSHOT_KEY },
    data: { value: JSON.stringify(snap) },
  });
  console.log("tampered:", { xau1h: snap.xau["1h"], xau4h: snap.xau["4h"], dji1wk: snap.dji["1wk"] });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
