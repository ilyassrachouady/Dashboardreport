"use client";
import { useEffect, useState } from "react";
import type { Dataset } from "../lib/model";

export function useLivePayments(initial: Dataset, demo: boolean) {
  const [live, setLive] = useState<Partial<Dataset>>({});
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => setLive({}), [initial]);
  useEffect(() => {
    if (demo) return;
    let disposed = false,
      inFlight = false,
      controller: AbortController | null = null,
      timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      if (disposed || inFlight) return;
      clearTimeout(timer);
      if (document.visibilityState !== "visible") {
        timer = setTimeout(refresh, 15000);
        return;
      }
      controller = new AbortController();
      inFlight = true;
      setRefreshing(true);
      try {
        const r = await fetch("/api/payments/live", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!r.ok)
          throw new Error(
            "Live payment refresh failed. Showing the last successful snapshot.",
          );
        const payload = await r.json();
        if (!disposed)
          setLive((previous) => ({
            ...previous,
            ...payload,
          }));
      } catch (e) {
        if (!disposed)
          setLive((previous) => ({
            ...previous,
            whopHistoryError:
              e instanceof Error ? e.message : "Payment refresh failed",
            whopBalanceError: "Live balance refresh failed",
            crmCashError: "Live CRM refresh failed",
            crmAttendanceError: "Live CRM refresh failed",
            crmStructuresError: "Live CRM refresh failed",
          }));
      } finally {
        inFlight = false;
        if (!disposed) {
          setRefreshing(false);
          timer = setTimeout(refresh, 15000);
        }
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    timer = setTimeout(refresh, 15000);
    return () => {
      disposed = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      controller?.abort();
    };
  }, [demo, initial]);
  return { data: { ...initial, ...live }, refreshing };
}
