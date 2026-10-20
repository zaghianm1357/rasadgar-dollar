"use client";

import { ExternalLink, Info, Hand, Layers, BellRing, SlidersHorizontal } from "lucide-react";

/** اپ «درباره» — منابع، روش تحلیل، راهنمای حرکات و سلب مسئولیت */
export function AboutApp() {
  return (
    <div className="flex flex-col gap-3 p-4">
      <section className="rounded-2xl border border-border/70 bg-card/70 p-3.5">
        <div className="mb-1.5 flex items-center gap-2">
          <Info className="h-4 w-4 text-primary" />
          <h2 className="text-[13px] font-extrabold">رصدگر دلار — نسخه پوسته موبایل</h2>
        </div>
        <p className="text-[11px] leading-6 text-muted-foreground">
          ابزار پایش اخبار اقتصادی USD و ساختار بازار طلا و داو جونز با رابط کاملاً لمسی:
          صفحات قابل سوایپ، ویجت‌های زنده، مرکز اعلان‌ها و مرکز کنترل — همه با انیمیشن‌های
          روان و حس بومی موبایل.
        </p>
      </section>

      <section className="rounded-2xl border border-border/70 bg-card/70 p-3.5">
        <div className="mb-1.5 flex items-center gap-2">
          <Hand className="h-4 w-4 text-amber-400" />
          <h2 className="text-[13px] font-extrabold">حرکات لمسی</h2>
        </div>
        <ul className="flex flex-col gap-1.5 text-[11px] leading-5 text-muted-foreground">
          <li>• نگه‌داشتن هر آیکون (حدود نیم ثانیه) → حالت لرزش؛ سپس آیکون‌ها را بکشید تا جابه‌جا شوند و «پایان» را بزنید.</li>
          <li>• کشیدن به چپ/راست → جابه‌جایی بین صفحات با پارالاکس کاغذدیواری.</li>
          <li>• کشیدن از بالای صفحه → مرکز اعلان‌ها (تغییر جهت بازار و وضعیت سامانه).</li>
          <li>• کشیدن از پایین صفحه → مرکز کنترل (کلیدهای بروزرسانی و فیلتر).</li>
          <li>• لمس آیکون اپ → باز شدن با انیمیشن بزرگ‌نمایی از همان آیکون؛ نوار پایین → بازگشت.</li>
        </ul>
      </section>

      <section className="rounded-2xl border border-border/70 bg-card/70 p-3.5">
        <div className="mb-1.5 flex items-center gap-2">
          <Layers className="h-4 w-4 text-sky-400" />
          <h2 className="text-[13px] font-extrabold">منابع داده و روش تحلیل</h2>
        </div>
        <ul className="flex flex-col gap-1.5 text-[11px] leading-5 text-muted-foreground">
          <li>
            • اخبار اقتصادی USD:{" "}
            <a
              href="https://www.forexfactory.com/calendar"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-primary hover:underline"
            >
              ForexFactory
              <ExternalLink className="h-3 w-3" />
            </a>{" "}
            با ترجمه و تحلیل تأثیر هوش مصنوعی.
          </li>
          <li>• قیمت طلا/نقره/داوجونز: Yahoo Finance از «لایه داده واحد» ابزار — همه صفحات از یک منبع تغذیه می‌شوند و برای طلا/نقره با اسپات gold-api کالیبره می‌شوند تا عدد همه صفحات یکی باشد.</li>
          <li>• ساختار بازار: ترکیب EMA۲۰/۵۰ و سقف/کف‌های سوئینگ در ۶ تایم‌فریم + تایم‌فریم ورود ۵ دقیقه.</li>
          <li>• دماسنج فشار: رأی فنی{" "}
            <a
              href="https://www.tradingview.com/symbols/XAUUSD/technicals/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-primary hover:underline"
            >
              تریدینگ‌ویو (Technicals)
              <ExternalLink className="h-3 w-3" />
            </a>{" "}
            — همان نوسانگرها و میانگین‌های متحرک آن صفحه؛ فقط سه حالت (فشار خرید/خنثی/فشار فروش) نمایش داده می‌شود و در نبود تریدینگ‌ویو، اجماع ۱۶ اندیکاتور محلی جایگزین می‌شود.</li>
          <li>
            • تحلیل و پیش‌بینی طلا:{" "}
            <a
              href="https://www.litefinance.org/blog/analysts-opinions/gold-price-prediction-forecast/daily-and-weekly/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-primary hover:underline"
            >
              LiteFinance
              <ExternalLink className="h-3 w-3" />
            </a>{" "}
            (پیش‌بینی فردا و هفته) +{" "}
            <a
              href="https://www.fxstreet.com/commodities/gold"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-primary hover:underline"
            >
              FXStreet
              <ExternalLink className="h-3 w-3" />
            </a>{" "}
            (تحلیل‌ها و نظرسنجی) + نقشهٔ مسیر امروز: تلفیق رأی همهٔ منابع ابزار در سه سناریو با محرک و ابطال.
          </li>
        </ul>
      </section>

      <section className="rounded-2xl border border-border/70 bg-card/70 p-3.5">
        <div className="mb-1.5 flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-violet-400" />
          <h2 className="text-[13px] font-extrabold">تنظیمات</h2>
        </div>
        <p className="text-[11px] leading-5 text-muted-foreground">
          بروزرسانی خودکار، فیلتر اخبار و بروزرسانی اجباری از{" "}
          <BellRing className="inline h-3 w-3" /> مرکز کنترل (کشیدن از پایین صفحه) در
          دسترس است؛ انتخاب‌ها در همین دستگاه ذخیره می‌شود.
        </p>
      </section>

      <p className="px-2 text-center text-[9px] leading-4 text-muted-foreground/70">
        این ابزار صرفاً اطلاع‌رسانی است و توصیه سرمایه‌گذاری محسوب نمی‌شود.
      </p>
    </div>
  );
}
