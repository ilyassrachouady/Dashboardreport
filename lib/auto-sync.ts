import "server-only";

import { database, isDemo } from "./db";
import { runSync } from "./sync";

export const AUTO_SYNC_SOURCES = ["ghl", "trakyo", "webinars", "whop"] as const;
type SyncSource = (typeof AUTO_SYNC_SOURCES)[number];

const DEFAULT_FRESH_FOR_MS = 15 * 60 * 1000;
const RUNNING_GRACE_MS = 6 * 60 * 1000;

async function sourceNeedsRefresh(
  source: SyncSource,
  freshForMs: number,
): Promise<boolean> {
  const db = database();
  const now = Date.now();

  const recentCutoff = new Date(now - Math.max(0, freshForMs)).toISOString();
  const runningCutoff = new Date(now - RUNNING_GRACE_MS).toISOString();

  const [recent, running] = await Promise.all([
    db
      .from("sync_runs")
      .select("id")
      .eq("source", source)
      .not("completed_at", "is", null)
      .gte("completed_at", recentCutoff)
      .limit(1),
    db
      .from("sync_runs")
      .select("id")
      .eq("source", source)
      .eq("status", "running")
      .gte("started_at", runningCutoff)
      .limit(1),
  ]);

  if (recent.error || running.error) {
    return false;
  }

  return (recent.data?.length ?? 0) === 0 && (running.data?.length ?? 0) === 0;
}

export async function refreshStaleSources({
  freshForMs = DEFAULT_FRESH_FOR_MS,
}: {
  freshForMs?: number;
} = {}) {
  if (isDemo()) {
    return { refreshed: [], skipped: [...AUTO_SYNC_SOURCES], results: [] };
  }

  const checks = await Promise.all(
    AUTO_SYNC_SOURCES.map(async (source) => ({
      source,
      due: await sourceNeedsRefresh(source, freshForMs),
    })),
  );

  const due = checks.filter((item) => item.due).map((item) => item.source);
  const skipped = checks.filter((item) => !item.due).map((item) => item.source);

  if (!due.length) {
    return { refreshed: [], skipped, results: [] };
  }

  const settled = await Promise.allSettled(
    due.map(async (source) => ({ source, ...(await runSync(source)) })),
  );

  const results = settled.map((result, index) =>
    result.status === "fulfilled"
      ? result.value
      : {
          source: due[index],
          status: "failed" as const,
          processed: 0,
          failed: 1,
        },
  );

  return {
    refreshed: due,
    skipped,
    results,
  };
}
