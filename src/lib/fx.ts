import { useCallback, useEffect, useRef, useState } from "react";
import { CURRENCIES, FX_STORAGE_KEY, FX_FALLBACK_RATES, FX_API_URLS } from "./constants";
import { loadFromStorage, saveToStorage } from "./storage";

export type FxStatus = "loading" | "live" | "cached" | "offline";

// Shared between Budget and Convert so both read/write the exact same
// cache — ported from the web app's Converter.jsx fetch logic, just with
// AsyncStorage's async API instead of localStorage's synchronous one.
export function useFxRates() {
  const [rates, setRates] = useState<Record<string, number>>(FX_FALLBACK_RATES);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [status, setStatus] = useState<FxStatus>("loading");
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const updatedAtRef = useRef<string | null>(null);

  const fetchRates = useCallback(async () => {
    setStatus("loading");
    setErrorDetail(null);
    const attempts: string[] = [];
    for (const url of FX_API_URLS) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const usd = data.usd || {};
        const newRates: Record<string, number> = { USD: 1 };
        CURRENCIES.forEach((c) => {
          if (c === "USD") return;
          const v = usd[c.toLowerCase()];
          if (v) newRates[c] = v;
        });
        if (Object.keys(newRates).length < CURRENCIES.length - 5) {
          throw new Error("unexpected response shape");
        }
        const date = data.date || new Date().toISOString().slice(0, 10);
        setRates(newRates);
        setUpdatedAt(date);
        updatedAtRef.current = date;
        saveToStorage(FX_STORAGE_KEY, { rates: newRates, date });
        setStatus("live");
        return;
      } catch (e: any) {
        attempts.push(e?.message || String(e));
      }
    }
    setErrorDetail(attempts.join(" / "));
    setStatus(updatedAtRef.current ? "cached" : "offline");
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cached = await loadFromStorage<{ rates: Record<string, number>; date: string }>(FX_STORAGE_KEY);
      if (cancelled) return;
      if (cached?.rates) {
        setRates(cached.rates);
        setUpdatedAt(cached.date);
        updatedAtRef.current = cached.date;
      }
      fetchRates();
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchRates]);

  return { rates, updatedAt, status, errorDetail, refetch: fetchRates };
}
