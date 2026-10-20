import "server-only";
import { fetchWhopHistory } from "./integrations/whop-history";
import { webinarTagMap } from "./integrations/ghl-webinar";
import { createClient } from "@supabase/supabase-js";
import { emptyDataset, type Dataset } from "./model";
import { demoDataset } from "./demo";
export const isDemo = () => process.env.DEMO_MODE === "true";
export function database() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
    throw new Error(
      "Supabase is not configured. Apply the reporting schema and set server environment variables.",
    );
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false },
      db: { schema: process.env.SUPABASE_SCHEMA || "revenue_intelligence" },
    },
  );
}
const tables = {
  contacts: "contacts",
  webinars: "webinars",
  registrations: "webinar_registrations",
  touches: "attribution_touches",
  appointments: "appointments",
  calls: "sales_calls",
  sales: "sales",
  payments: "payments",
  mappings: "source_mappings",
  syncRuns: "sync_runs",
} as const;
export async function loadDataset(): Promise<{
  data: Dataset;
  demo: boolean;
  error: string | null;
}> {
  if (isDemo()) return { data: demoDataset(), demo: true, error: null };
  try {
    const db = database(),
      data = emptyDataset();
    const loaded = await Promise.all(
      Object.entries(tables).map(async ([key, table]) => {
        const rows: unknown[] = [];
        for (let start = 0; ; start += 1000) {
          const readPage = () =>
            db
              .from(table)
              .select("*")
              .order("id")
              .range(start, start + 999)
              .abortSignal(AbortSignal.timeout(15000));
          let r = await readPage();
          if (r.error) r = await readPage();
          if (r.error)
            throw new Error(
              `Unable to load ${table}. Refresh to retry the database connection.`,
            );
          rows.push(...r.data);
          if (r.data.length < 1000) break;
        }
        return [key, rows] as const;
      }),
    );
    Object.assign(data, Object.fromEntries(loaded));
    try {
      data.whopPayments = await fetchWhopHistory();
    } catch (e) {
      data.whopHistoryError =
        e instanceof Error ? e.message : "Whop history unavailable";
    }
    const cohortMap = webinarTagMap();
    data.webinarCrm = Object.fromEntries(
      data.webinars.flatMap((w) => {
        const tag = cohortMap[w.external_id];
        if (!tag) return [];
        const run = data.syncRuns
          .filter(
            (r) =>
              r.source === `ghl_webinar:${w.id}` && r.status === "succeeded",
          )
          .sort((a, b) => b.started_at.localeCompare(a.started_at))[0];
        const bookings = data.syncRuns
          .filter(
            (r) => r.source === "ghl_bookings" && r.status === "succeeded",
          )
          .sort((a, b) => b.started_at.localeCompare(a.started_at))[0];
        return [
          [
            w.id,
            {
              tag,
              syncedAt: run?.completed_at || null,
              bookingsSyncedAt: bookings?.completed_at || null,
            },
          ],
        ];
      }),
    );
    return { data, demo: false, error: null };
  } catch (e) {
    return {
      data: emptyDataset(),
      demo: false,
      error: e instanceof Error ? e.message : "Reporting data unavailable",
    };
  }
}
