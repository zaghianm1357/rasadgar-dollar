import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { initialQuotes, stepQuotes, type Quote } from "./market";

interface MarketState {
  quotes: Record<string, Quote>;
  now: number;
  paused: boolean;
  sound: boolean;
  compact: boolean;
  togglePause: () => void;
  toggleSound: () => void;
  toggleCompact: () => void;
}

const Ctx = createContext<MarketState | null>(null);

export function MarketProvider({ children }: { children: ReactNode }) {
  const [quotes, setQuotes] = useState<Record<string, Quote>>(() => initialQuotes());
  const [now, setNow] = useState(() => Date.now());
  const [paused, setPaused] = useState(false);
  const [sound, setSound] = useState(true);
  const [compact, setCompact] = useState(false);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    const ticks = window.setInterval(() => {
      if (!pausedRef.current) setQuotes(stepQuotes);
    }, 1400);
    return () => {
      window.clearInterval(clock);
      window.clearInterval(ticks);
    };
  }, []);

  const togglePause = useCallback(() => setPaused((p) => !p), []);
  const toggleSound = useCallback(() => setSound((s) => !s), []);
  const toggleCompact = useCallback(() => setCompact((c) => !c), []);

  const value = useMemo(
    () => ({ quotes, now, paused, sound, compact, togglePause, toggleSound, toggleCompact }),
    [quotes, now, paused, sound, compact, togglePause, toggleSound, toggleCompact],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMarket(): MarketState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useMarket must be used inside MarketProvider");
  return ctx;
}
