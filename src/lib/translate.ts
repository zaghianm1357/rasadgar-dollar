import ZAI from "z-ai-web-dev-sdk";
import { db } from "@/lib/db";
import type { EconomicEvent } from "@prisma/client";
import { faTime } from "@/lib/tehran";

const TRANSLATE_SYSTEM = `تو یک مترجم حرفه‌ای و تحلیلگر خبره بازار فارکس و اقتصاد کلان هستی.
ورودی تو آرایه‌ای از رویدادهای تقویم اقتصادی ForexFactory مربوط به دلار آمریکا (USD) است.
برای هر رویداد این سه کار را انجام بده:

1) "titleFa": ترجمه روان، دقیق و استاندارد عنوان رویداد به فارسی. نام‌های شاخص معروف را با معادل رایج فارسی بنویس و مخفف انگلیسی را داخل پرانتز نگه دار. مثال: "Non-Farm Employment Changes" ← «تغییرات اشتغال غیرکشاورزی (NFP)» ، "CPI m/m" ← «شاخص قیمت مصرف‌کننده ماهانه (CPI)» ، "FOMC Statement" ← «بیانیه کمیته فدرال رزرو (FOMC)». برای نام اشخاص، فقط نام را انتقال بده (مثلاً «سخنرانی جروم پاول»).

2) "direction": جهت تأثیر این رویداد بر ارزش دلار آمریکا را با این منطق استاندارد بازار مشخص کن:
   - "bullish": رویداد به‌طور معمول داده قوی‌تر از انتظار → تقویت دلار (مثل اشتغال، تورم، GDP، نرخ بهره بالاتر)
   - "bearish": رویداد به‌طور معمول داده قوی‌تر از انتظار → تضعیف دلار (مثلClaims بیمه بیکاری بالاتر، اشتغال ضعیف‌تر)
   - "mixed": رویداد دووجهی است یا بستگی به جزئیات دارد (مثل بیانیه‌های فدرال رزرو، سخنرانی‌ها)
   - "neutral": تأثیر مستقیم و مشخصی بر دلار ندارد (مثل تعطیلات رسمی)
   توجه: جهت پیش‌فرض رویداد را بگو، نه نتیجه عدد واقعی را.

3) "explanationFa": توضیح فارسی روان:
   - برای High: ۲ تا ۴ جمله. اول بگو این شاخص چه چیزی را اندازه می‌گیرد و چرا برای دلار مهم است. سپس به‌طور صریح بگو: «اگر این عدد بالاتر/بهتر از پیش‌بینی باشد نرخ دلار افزایش می‌یابد/کاهش می‌یابد» و «اگر پایین‌تر/ضعیف‌تر باشد برعکس». اگر مقدار "actual" (عدد واقعی) موجود بود، نتیجه واقعی را هم مقایسه و تحلیل کن (بهتر یا بدتر از پیش‌بینی بود و واکنش مورد انتظار دلار چه بود).
   - برای Medium: ۱ تا ۲ جمله با ذکر منطق افزایش/کاهش دلار.
   - برای Low و Holiday: یک جمله کوتاه.

پاسخ را فقط و فقط به صورت JSON معتبر برگردان: یک آرایه از آبجکت‌ها با کلیدهای "id" (همان id ورودی)، "titleFa"، "direction"، "explanationFa" — به همان ترتیب ورودی. بدون هیچ متن اضافه، بدون markdown، بدون توضیح اضافه.`;

const DIGEST_SYSTEM = `تو تحلیلگر ارشد بازار ارز هستی. یک «خلاصه روزانه» فارسی و حرفه‌ای (حداکثر ۴ جمله، حدود ۶۰ تا ۹۰ کلمه) از رویدادهای اقتصادی امروز دلار آمریکا بنویس.
ساختار پیشنهادی: اول تصویر کلی روز (چند خبر مهم داریم و مضمون اصلی چیست)، بعد اشاره به مهم‌ترین رویدادها با ساعت تهران و تأثیر مورد انتظار بر نرخ دلار (تقویت/تضعیف)، و در پایان یک نکته معاملاتی کوتاه.
از عناوین فارسی داده‌شده استفاده کن. بدون markdown، بدون فهرست گلوله‌ای، بدون سلام و تعارف و بدون متن اضافه — فقط متن خلاصه.`;

const translateLock: { current: Promise<unknown> } = { current: Promise.resolve() };

function runExclusive<T>(lock: { current: Promise<unknown> }, fn: () => Promise<T>): Promise<T> {
  const p = lock.current.then(fn, fn);
  lock.current = p.catch(() => undefined);
  return p;
}

function extractJsonArray(text: string): unknown[] {
  let t = text.trim();
  t = t.replace(/```json/gi, "```").replace(/```/g, "");
  const start = t.indexOf("[");
  const end = t.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return [];
  try {
    const arr = JSON.parse(t.slice(start, end + 1));
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function normalizeDirection(v: unknown): "bullish" | "bearish" | "mixed" | "neutral" {
  const s = String(v || "").toLowerCase().trim();
  if (s === "bullish" || s === "bearish" || s === "mixed" || s === "neutral") return s;
  return "neutral";
}

interface TranslateOut {
  id: string;
  titleFa: string;
  direction: "bullish" | "bearish" | "mixed" | "neutral";
  explanationFa: string;
}

async function callTranslateBatch(items: EconomicEvent[]): Promise<TranslateOut[]> {
  const zai = await ZAI.create();
  const payload = items.map((e) => ({
    id: e.eventKey,
    title: e.title,
    impact: e.impact,
    forecast: e.forecast || "",
    previous: e.previous || "",
    actual: e.actual || "",
  }));

  const completion = await zai.chat.completions.create({
    messages: [
      { role: "assistant", content: TRANSLATE_SYSTEM },
      { role: "user", content: JSON.stringify(payload) },
    ],
    thinking: { type: "disabled" },
  });

  const raw = completion.choices[0]?.message?.content || "";
  const arr = extractJsonArray(raw);

  const outs: TranslateOut[] = [];
  for (const o of arr) {
    if (!o || typeof o !== "object") continue;
    const obj = o as Record<string, unknown>;
    const id = String(obj.id ?? "").trim();
    const titleFa = String(obj.titleFa ?? "").trim();
    if (!id || !titleFa) continue;
    outs.push({
      id,
      titleFa,
      direction: normalizeDirection(obj.direction),
      explanationFa: String(obj.explanationFa ?? "").trim(),
    });
  }
  return outs;
}

const IMPACT_WEIGHT: Record<string, number> = { High: 0, Medium: 1, Low: 2, Holiday: 3 };

/** رویدادهای بدون ترجمه را به‌صورت دسته‌ای ترجمه می‌کند (مهم‌ترین‌ها اول) و تعداد ترجمه‌شده‌ها را برمی‌گرداند. */
export async function translatePendingEvents(limit = 32, batchSize = 8): Promise<number> {
  return runExclusive(translateLock, async () => {
    const pending = await db.economicEvent.findMany({
      where: { country: "USD", titleFa: null },
    });
    if (pending.length === 0) return 0;

    pending.sort((a, b) => (IMPACT_WEIGHT[a.impact] ?? 9) - (IMPACT_WEIGHT[b.impact] ?? 9));
    const targets = pending.slice(0, limit);

    let done = 0;
    for (let i = 0; i < targets.length; i += batchSize) {
      const chunk = targets.slice(i, i + batchSize);
      try {
        const outs = await callTranslateBatch(chunk);
        for (const o of outs) {
          await db.economicEvent.updateMany({
            where: { eventKey: o.id },
            data: { titleFa: o.titleFa, direction: o.direction, explanationFa: o.explanationFa },
          });
          done++;
        }
      } catch (err) {
        console.error("[translate] batch failed:", (err as Error).message);
        break; // درخواست بعدی ادامه می‌دهد
      }
    }
    return done;
  });
}

/** خلاصه روزانه هوشمند برای تاریخ داده‌شده (با کش در دیتابیس). */
export async function ensureDailyDigest(
  digestKey: string,
  todayEvents: EconomicEvent[]
): Promise<string | null> {
  const existing = await db.dailyDigest.findUnique({ where: { digestKey } });
  if (existing) return existing.contentFa;
  if (todayEvents.length === 0) return null;

  return runExclusive(translateLock, async () => {
    const again = await db.dailyDigest.findUnique({ where: { digestKey } });
    if (again) return again.contentFa;

    try {
      const zai = await ZAI.create();
      const payload = todayEvents.map((e) => ({
        title: e.titleFa || e.title,
        time: e.date ? faTime(e.date) : "هم‌روز",
        impact: e.impact,
        direction: e.direction || "نامشخص",
        forecast: e.forecast || "",
        previous: e.previous || "",
        actual: e.actual || "",
      }));

      const completion = await zai.chat.completions.create({
        messages: [
          { role: "assistant", content: DIGEST_SYSTEM },
          { role: "user", content: JSON.stringify(payload) },
        ],
        thinking: { type: "disabled" },
      });

      const content = (completion.choices[0]?.message?.content || "").trim();
      if (!content) return null;

      await db.dailyDigest.upsert({
        where: { digestKey },
        update: { contentFa: content },
        create: { digestKey, contentFa: content },
      });
      return content;
    } catch (err) {
      console.error("[digest] failed:", (err as Error).message);
      return null;
    }
  });
}
