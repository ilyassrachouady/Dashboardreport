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
      controller: AbortController | null = null,
      timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      if (disposed) return;
      if (document.visibilityState !== "visible") {
        timer = setTimeout(refresh, 60000);
        return;
      }
      controller = new AbortController();
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
        if (!disposed) setLive({ ...payload, whopHistoryError: undefined });
      } catch (e) {
        if (!disposed)
          setLive((previous) => ({
            ...previous,
            whopHistoryError:
              e instanceof Error ? e.message : "Payment refresh failed",
          }));
      } finally {
        if (!disposed) {
          setRefreshing(false);
          timer = setTimeout(refresh, 60000);
        }
      }
    };
    timer = setTimeout(refresh, 60000);
    return () => {
      disposed = true;
      clearTimeout(timer);
      controller?.abort();
    };
  }, [demo, initial]);
  return { data: { ...initial, ...live }, refreshing };
}
