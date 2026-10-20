"use client";

/* سایت معرفی BIG TRADER — کامپوزیشن بخش‌ها با یک لایه دادهٔ مشترک */

import { useSiteData } from "./site-data";
import { SiteFooter, SiteHeader } from "./chrome";
import { Hero, Markets, Thermometer } from "./hero";
import { Analysis, Calendar, Features, Get, Showcase } from "./info";

export function BigTraderSite({ onOpenTool }: { onOpenTool: () => void }) {
  const { ms, news, pressure, analysis, tf, setTf } = useSiteData();

  return (
    <div className="flex min-h-screen flex-col bg-bt-ink-950 text-slate-100">
      <SiteHeader ms={ms.data} events={news.data?.events || null} onOpenTool={onOpenTool} />
      <main className="flex-1">
        <Hero ms={ms.data} events={news.data?.events || null} onOpenTool={onOpenTool} />
        <Markets ms={ms.data} changes={ms.data?.changes || []} />
        <Thermometer pressure={pressure} tf={tf} setTf={setTf} />
        <Calendar events={news.data?.events || null} />
        <Analysis analysis={analysis} />
        <Features />
        <Showcase ms={ms.data} onOpenTool={onOpenTool} />
        <Get onOpenTool={onOpenTool} />
      </main>
      <SiteFooter />
    </div>
  );
}
