"use client";

import { X, BellRing, Radio, Languages, Activity, ArrowLeftRight } from "lucide-react";
import type { MarketStructureResponse } from "@/lib/types";
import { faDigits, faTime, faDateLong } from "@/lib/tehran";
import { useShell } from "./shell-context";
import { ChangeRow } from "@/components/dashboard/trend-change-banner";

/**
 * مرکز اعلان‌ها — صفحه مات شیشه‌ای که از بالا کشیده می‌شود.
 * progress: صفر = مخفی، یک = باز کامل (میان‌مقادیر = دنبال‌کردن انگشت).
 */
export function NotificationCenter({
  progress,
  onClose,
}: {
  progress: number;
  onClose: () => void;
}) {
  const { news, ms, now } = useShell();
  const changes: MarketStructureResponse["changes"] = ms?.changes ?? [];

  const feedLabel =
    news?.feedStatus === "live"
      ? "بروزرسانی زنده فید اخبار"
      : news?.feedStatus === "cached"
        ? "فید اخبار — داده کش‌شده"
        : news?.feedStatus === "error"
          ? "خطای فید اخبار — داده محلی"
          : "در انتظار دریافت اخبار";

  return (
    <div
      className="absolute inset-0 z-[70]"
      style={{ pointerEvents: progress > 0 ? "auto" : "none" }}
      data-testid="notification-center"
    >
      {/* پس‌زمینه تیره */}
      <div
        className="absolute inset-0 bg-black/45"
        style={{ opacity: progress }}
        onClick={onClose}
      />
      {/* صفحه مات شیشه‌ای */}
      <div
        className="frost spring absolute inset-x-0 top-0 max-h-[85%] overflow-y-auto rounded-b-3xl border-b border-white/10 p-4 pt-3 no-scrollbar"
        style={{
          transform: `translateY(${(progress - 1) * 100}%)`,
          transition: progress === 0 || progress === 1 ? undefined : "none",
        }}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/25" />
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <p className="text-2xl font-extrabold tabular-nums leading-8">{faTime(now)}</p>
            <p className="text-[10px] text-muted-foreground">{faDateLong(now)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن مرکز اعلان‌ها"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/10 text-foreground/90 transition-colors hover:bg-white/20"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* تغییرات جهت بازار */}
        <section className="mb-3 rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="mb-2 flex items-center gap-1.5">
            <ArrowLeftRight className="h-3.5 w-3.5 text-amber-400" />
            <h3 className="text-[11px] font-extrabold">تغییر جهت بازار</h3>
            <BellRing className="ms-auto h-3 w-3 text-muted-foreground/70" />
          </div>
          {changes.length === 0 ? (
            <p className="text-[11px] leading-5 text-muted-foreground">
              تغییر جهت جدیدی در ۶ ساعت گذشته ثبت نشده است. هنگام تغییر روند ساختار در هر
              تایم‌فریم، اعلان به‌صورت خودکار اینجا ظاهر می‌شود.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {changes.slice(0, 6).map((c) => (
                <ChangeRow key={`${c.symbol}:${c.tf}:${c.atISO}`} change={c} />
              ))}
            </div>
          )}
        </section>

        {/* وضعیت سامانه */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="mb-2 flex items-center gap-1.5">
            <Radio className="h-3.5 w-3.5 text-primary" />
            <h3 className="text-[11px] font-extrabold">وضعیت سامانه</h3>
          </div>
          <div className="flex flex-col gap-2 text-[11px] leading-5">
            <div className="flex items-center gap-2">
              <Radio className="h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="text-muted-foreground">فید اخبار:</span>
              <span className="ms-auto font-bold">{feedLabel}</span>
            </div>
            {(news?.pendingTranslation ?? 0) > 0 && (
              <div className="flex items-center gap-2">
                <Languages className="h-3 w-3 shrink-0 text-amber-400" />
                <span className="text-muted-foreground">در نوبت ترجمه:</span>
                <span className="ms-auto font-bold text-amber-400">
                  {faDigits(news!.pendingTranslation)} خبر
                </span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Activity className="h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="text-muted-foreground">ساختار بازار:</span>
              <span className="ms-auto font-bold">
                {ms
                  ? ms.status === "live"
                    ? "محاسبه زنده"
                    : ms.status === "cached"
                      ? "کش ۱۵ دقیقه‌ای"
                      : "آخرین داده موجود"
                  : "در انتظار داده"}
                {ms?.updatedAtISO ? ` — ${faTime(new Date(ms.updatedAtISO))}` : ""}
              </span>
            </div>
          </div>
        </section>

        <p className="mt-2 text-center text-[9px] text-muted-foreground/70">
          برای بستن، به بالا بکشید یا پس‌زمینه را لمس کنید
        </p>
      </div>
    </div>
  );
}
