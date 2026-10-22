import "server-only";
import { notionWebinars } from "./integrations/notion";
import { fetchWhopHistory } from "./integrations/whop-history";
import { fetchWhopBalance } from "./integrations/whop-balance";
import {
  fetchCrmPaymentStructures,
  fetchTrakyoTransactions,
} from "./integrations/payment-context";
import { webinarTagMap } from "./integrations/ghl-webinar";
import { createClient } from "@supabase/supabase-js";
import { assignMissingSessionCodes } from "./session-code";
import { emptyDataset, type Dataset, type Webinar } from "./model";
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
async function persistSessionCodes(
  db: ReturnType<typeof database>,
  webinars: Webinar[],
) {
  const assigned = assignMissingSessionCodes(webinars);
  for (const row of assigned) {
    const saved = await db
      .from("webinars")
      .update({ session_code: row.session_code, client_series: row.client_series })
      .eq("id", row.id)
      .is("session_code", null)
      .select("id");
    if (saved.error && !/session_code|client_series/.test(saved.error.message))
      throw new Error("Session code could not be saved.");
  }
  const byId = new Map(assigned.map((row) => [row.id, row]));
  return webinars.map((webinar) =>
    byId.has(webinar.id) ? { ...webinar, ...byId.get(webinar.id) } : webinar,
  );
}
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
    data.webinars = await persistSessionCodes(db, data.webinars);
    await Promise.all([
      (async () => {
        try {
          data.whopBalance = await fetchWhopBalance();
        } catch (e) {
          data.whopBalanceError =
            e instanceof Error ? e.message : "Whop balance unavailable";
        }
      })(),
      (async () => {
        try {
          data.whopPayments = await fetchWhopHistory();
          data.whopFetchedAt = new Date().toISOString();
        } catch (e) {
          data.whopHistoryError =
            e instanceof Error ? e.message : "Whop history unavailable";
        }
      })(),
      (async () => {
        try {
          const context = await fetchCrmPaymentStructures(
            process.env.GHL_LOCATION_ID || "",
          );
          data.crmPaymentStructures = context.rows;
          data.crmCash = context.cashRows;
          data.crmCallSnapshots = context.snapshots;
          data.crmSnapshotError = context.snapshotError;
          data.crmAttendance = context.attendanceRows;
          data.crmAttendanceError = context.attendanceError;
          data.crmCashError = context.cashError;
          data.crmStructuresFetchedAt = context.fetchedAt;
        } catch (e) {
          data.crmStructuresError =
            e instanceof Error
              ? e.message
              : "CRM payment structures unavailable";
          data.crmCashError = "GHL Cash Collected could not be refreshed";
          data.crmAttendanceError = "GHL Attendance could not be refreshed";
        }
      })(),
      (async () => {
        try {
          data.trakyoTransactions = await fetchTrakyoTransactions();
        } catch (e) {
          data.trakyoTransactionsError =
            e instanceof Error ? e.message : "Trakyo transactions unavailable";
        }
      })(),
    ]);
    const cohortMap = webinarTagMap(data.webinars);
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
    data.webinars = await notionWebinars(data.webinars);
    return { data, demo: false, error: null };
  } catch (e) {
    return {
      data: emptyDataset(),
      demo: false,
      error: e instanceof Error ? e.message : "Reporting data unavailable",
    };
  }
}
