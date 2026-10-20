"use client";

/**
 * روتر تک‌مسیر پیش‌نمایش:
 *  — پیش‌فرض: سایت معرفی BIG TRADER
 *  — /?view=tool : ابزار رصدگر دلار (پوسته موبایل)
 * لینک‌های عمومی: / و /?view=tool هر دو کار می‌کنند؛ دکمهٔ برگشت مرورگر هم بین دو نما کار می‌کند.
 */
import { useCallback, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { BigTraderSite } from "@/components/site/big-trader-site";

const PhoneShell = dynamic(() => import("@/components/phone/phone-shell").then((m) => ({ default: m.PhoneShell })), {
  ssr: false,
  loading: () => (
    <div className="grid min-h-screen place-items-center bg-background">
      <div className="animate-pulse text-[13px] text-muted-foreground">در حال بازکردن ابزار…</div>
    </div>
  ),
});

type View = "site" | "tool";

function readView(): View {
  try {
    return new URLSearchParams(window.location.search).get("view") === "tool" ? "tool" : "site";
  } catch {
    return "site";
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener("btview", onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener("btview", onChange);
  };
}

function navigate(path: string) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new Event("btview"));
}

export default function Home() {
  const view = useSyncExternalStore(
    subscribe,
    readView,
    () => "site" as View,
  );

  const openTool = useCallback(() => navigate("/?view=tool"), []);
  const openSite = useCallback(() => navigate("/"), []);

  if (view === "tool") {
    return (
      <>
        <button
          onClick={openSite}
          className="fixed left-2 top-1/2 z-[60] hidden -translate-y-1/2 rounded-xl border border-white/10 bg-white/5 px-2 py-3 text-[10px] text-slate-300 backdrop-blur transition hover:text-white lg:block"
          aria-label="بازگشت به سایت معرفی"
          title="بازگشت به سایت معرفی"
        >
          ‹ سایت
        </button>
        <PhoneShell />
      </>
    );
  }

  return <BigTraderSite onOpenTool={openTool} />;
}
