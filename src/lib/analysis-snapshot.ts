/**
 * اسنپ‌شات داخلی تحلیل طلا — آخرین پشتوانه وقتی همه مسیرهای زنده قطع باشند.
 *
 * صداقت داده: این اعداد از محتوای واقعی سایت‌های منبع خوانده و در زمان ساخت
 * ثبت شده‌اند؛ در UI با برچسب «اسنپ‌شات» و تاریخ گزارش نمایش داده می‌شوند تا
 * کاربر بداند داده زنده نیست. هیچ عددی حدس زده نمی‌شود.
 *
 * تاریخ گزارش: ۲۰ اکتبر ۲۰۲۶ (از خود صفحه LiteFinance/FXStreet خوانده شد)
 */

import type { GoldBriefing } from "@/lib/analysis-sources";

export const ANALYSIS_SNAPSHOT: GoldBriefing = {
  ok: true,
  stale: true,
  ageMin: null,
  generatedAtISO: "2026-10-20T00:00:00.000Z",
  lite: {
    ok: true,
    via: "اسنپ‌شات داخلی — گزارش ۲۰ اکتبر ۲۰۲۶",
    reportedAtFa: "October 20, 2026",
    baseScenario: "long",
    baseScenarioFa: "سناریوی اصلی: خرید بالای سطح مشخص‌شده",
    longAbove: 4202.4,
    shortBelow: 4157.41,
    stopLoss: 4180.17,
    targets: [4254.97, 4313.67, 4376.04],
    tomorrow: { low: 4057.82, avg: 4185.74, high: 4313.67 },
    week: { low: 4007.83, avg: 4258.78, high: 4509.74 },
    rsi: 56,
  },
  fx: {
    ok: true,
    via: "اسنپ‌شات داخلی — گزارش ۲۰ اکتبر ۲۰۲۶",
    poll: [
      { periodFa: "هفته آینده", avg: 4155.33, mixFa: "۶۷٪ رنج · ۳۳٪ نزولی" },
      { periodFa: "ماه آینده", avg: 4396.67, mixFa: "۶۷٪ صعودی · ۳۳٪ رنج" },
      { periodFa: "سه‌ماه آینده", avg: 4630.0, mixFa: "۷۱٪ صعودی · ۲۹٪ رنج" },
    ],
    items: [
      {
        title: "Gold braces for US CPI near $4,100: 3 analysts, 3 different maps of what happens next",
        titleFa: "طلا در محدوده ۴۱۰۰ دلار چشم‌دوزان انتشار CPI آمریکا است — سه تحلیلگر، سه نقشه متفاوت",
        url: "https://www.fxstreet.com/commodities/gold",
      },
      {
        title: "Gold Price Forecast: XAU/USD looks to $4100 and US CPI inflation amid geopolitical risks",
        titleFa: "پیش‌بینی قیمت طلا: توجه XAU/USD به ۴۱۰۰ دلار و تورم CPI در میانه ریسک‌های ژئوپلیتیک",
        url: "https://www.fxstreet.com/commodities/gold",
      },
      {
        title: "Gold Weekly Forecast: Precious metal finds support but upside potential remains limited",
        titleFa: "پیش‌بینی هفتگی طلا: فلز گران‌بها به حمایت رسید اما پتانسیل صعودی محدود می‌ماند",
        url: "https://www.fxstreet.com/commodities/gold",
      },
    ],
  },
  tv: { ok: false, stateFa: null, error: "در حالت اسنپ‌شات، رأی زنده تریدینگ‌ویو نمایش داده نمی‌شود — تب دماسنج را ببینید" },
  summaryFa: [],
  sourcesNoteFa:
    "حالت اسنپ‌شات: دریافت زنده از LiteFinance/FXStreet/تریدینگ‌ویو ناموفق بود و آخرین نسخه ذخیره‌شده هنگام ساخت ابزار نمایش داده می‌شود — تاریخ هر بخش را حتماً ببینید.",
};
