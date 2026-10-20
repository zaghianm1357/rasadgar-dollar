"use client";

import {
  RefreshCw,
  Newspaper,
  Activity,
  Flame,
  Database,
  Wifi,
  BatteryFull,
  SignalHigh,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useShell } from "./shell-context";

/**
 * مرکز کنترل — صفحه مات شیشه‌ای که از پایین کشیده می‌شود.
 * کلیدهای واقعی: پولینگ خودکار اخبار/بازار، فیلتر «فقط مهم»، بروزرسانی اجباری.
 */

function ToggleTile({
  icon: Icon,
  label,
  checked,
  onChange,
  accent,
}: {
  icon: typeof Newspaper;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  accent: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/8 p-3">
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${accent}`}>
        <Icon className="h-4 w-4" />
      </div>
      <label className="min-w-0 flex-1 cursor-pointer text-[10px] font-bold leading-4">
        {label}
      </label>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </div>
  );
}

function ActionTile({
  icon: Icon,
  label,
  busy,
  onClick,
  accent,
}: {
  icon: typeof Newspaper;
  label: string;
  busy: boolean;
  onClick: () => void;
  accent: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/8 p-3 text-start transition-colors hover:bg-white/14 disabled:opacity-70"
    >
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${accent}`}>
        <Icon className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
      </div>
      <span className="min-w-0 flex-1 text-[10px] font-bold leading-4">{label}</span>
    </button>
  );
}

export function ControlCenter({
  progress,
  onClose,
}: {
  progress: number;
  onClose: () => void;
}) {
  const { settings, updateSettings, refreshNews, refreshMarket, newsRefreshing, msRefreshing } =
    useShell();

  return (
    <div
      className="absolute inset-0 z-[70]"
      style={{ pointerEvents: progress > 0 ? "auto" : "none" }}
      data-testid="control-center"
    >
      <div
        className="absolute inset-0 bg-black/45"
        style={{ opacity: progress }}
        onClick={onClose}
      />
      <div
        className="frost spring absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-white/10 p-4 pb-6"
        style={{
          transform: `translateY(${(1 - progress) * 100}%)`,
          transition: progress === 0 || progress === 1 ? undefined : "none",
        }}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/25" />
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-extrabold">مرکز کنترل</h3>
          <div className="flex items-center gap-2 text-muted-foreground">
            <SignalHigh className="h-3.5 w-3.5" />
            <Wifi className="h-3.5 w-3.5" />
            <BatteryFull className="h-4 w-4" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <ToggleTile
            icon={Newspaper}
            label="بروزرسانی خودکار اخبار (هر ۲ دقیقه)"
            checked={settings.autoNews}
            onChange={(v) => updateSettings({ autoNews: v })}
            accent="border-primary/30 bg-primary/15 text-primary"
          />
          <ToggleTile
            icon={Activity}
            label="بروزرسانی خودکار ساختار بازار (هر ۵ دقیقه)"
            checked={settings.autoMarket}
            onChange={(v) => updateSettings({ autoMarket: v })}
            accent="border-sky-500/30 bg-sky-500/15 text-sky-400"
          />
          <ToggleTile
            icon={Flame}
            label="تمرکز روی اخبار خیلی مهم"
            checked={settings.highOnly}
            onChange={(v) => updateSettings({ highOnly: v })}
            accent="border-amber-500/30 bg-amber-500/15 text-amber-400"
          />
          <div className="rounded-2xl border border-white/10 bg-white/8 p-3">
            <div className="mb-1 flex items-center gap-2">
              <Database className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="text-[10px] font-bold">منابع داده</span>
            </div>
            <p className="text-[9px] leading-4 text-muted-foreground">
              اخبار: ForexFactory — بازار: Yahoo Finance + اسپات — دماسنج: تریدینگ‌ویو — تحلیل و پیش‌بینی: LiteFinance/FXStreet/تریدینگ‌ویو
            </p>
          </div>
          <ActionTile
            icon={RefreshCw}
            label="بروزرسانی اجباری اخبار"
            busy={newsRefreshing}
            onClick={() => refreshNews(true)}
            accent="border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
          />
          <ActionTile
            icon={RefreshCw}
            label="بروزرسانی اجباری ساختار بازار"
            busy={msRefreshing}
            onClick={() => refreshMarket(true)}
            accent="border-violet-500/30 bg-violet-500/15 text-violet-400"
          />
        </div>

        <p className="mt-3 text-center text-[9px] text-muted-foreground/70">
          برای بستن، به پایین بکشید یا پس‌زمینه را لمس کنید
        </p>
      </div>
    </div>
  );
}
