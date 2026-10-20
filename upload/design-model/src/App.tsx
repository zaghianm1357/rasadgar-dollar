import { useState } from "react";
import { MarketProvider } from "@/lib/MarketContext";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Markets from "@/components/Markets";
import Insights from "@/components/Insights";
import Calendar from "@/components/Calendar";
import Summary from "@/components/Summary";
import Features from "@/components/Features";
import AppShowcase from "@/components/AppShowcase";
import Plans from "@/components/Plans";
import Footer, { ControlDock } from "@/components/Footer";
import NotificationCenter from "@/components/NotificationCenter";

export default function App() {
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  return (
    <MarketProvider>
      <div className="min-h-screen bg-ink-950 text-slate-100">
        <Header onOpenNotifications={() => setNotificationsOpen(true)} />
        <main>
          <Hero />
          <Markets />
          <Insights />
          <Calendar />
          <Summary />
          <Features />
          <AppShowcase />
          <Plans />
        </main>
        <Footer />
        <ControlDock onOpenNotifications={() => setNotificationsOpen(true)} />
        <NotificationCenter open={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
      </div>
    </MarketProvider>
  );
}
