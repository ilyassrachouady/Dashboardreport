import { notionWebinars } from "../../../../lib/integrations/notion";
import { database } from "../../../../lib/db";
import { NextResponse } from "next/server";
import { isDemo } from "../../../../lib/db";
import { fetchWhopHistory } from "../../../../lib/integrations/whop-history";
import { fetchWhopBalance } from "../../../../lib/integrations/whop-balance";
import {
  fetchCrmPaymentStructures,
  fetchTrakyoTransactions,
} from "../../../../lib/integrations/payment-context";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
// Access is protected by the dashboard's existing Basic Auth proxy.
export async function GET() {
  if (isDemo())
    return NextResponse.json(
      { error: "Live polling is disabled in demo mode" },
      { status: 409 },
    );
  try {
    const [payments, crm, trakyo, balance, sessions] = await Promise.all([
      fetchWhopHistory()
        .then((value) => ({ value, error: null as string | null }))
        .catch((e) => ({
          value: undefined,
          error: e instanceof Error ? e.message : "Whop payments unavailable",
        })),
      fetchCrmPaymentStructures(process.env.GHL_LOCATION_ID || "")
        .then((value) => ({ value, error: undefined as string | undefined }))
        .catch((e) => ({
          value: undefined,
          error: e instanceof Error ? e.message : "GHL unavailable",
        })),
      fetchTrakyoTransactions()
        .then((value) => ({ value, error: undefined as string | undefined }))
        .catch((e) => ({
          value: undefined,
          error: e instanceof Error ? e.message : "Trakyo unavailable",
        })),
      fetchWhopBalance()
        .then((value) => ({ value, error: null as string | null }))
        .catch((e) => ({
          value: undefined,
          error: e instanceof Error ? e.message : "Whop balance unavailable",
        })),
      (async () => {
        const result = await database().from("webinars").select("*");
        if (result.error) return undefined;
        const appointments: import("../../../../lib/model").Appointment[] = [];
        for (let start = 0; ; start += 1000) {
          const page = await database().from("appointments").select("*").order("id").range(start,start+999);
          if (page.error) return undefined;
          appointments.push(...page.data);
          if (page.data.length < 1000) break;
        }
        const attendance: NonNullable<import("../../../../lib/model").Dataset["webinarAttendance"]> = [];
        for (let start = 0; ; start += 1000) {
          const page = await database().from("webinar_attendance").select("*").order("id").range(start,start+999);
          if (page.error) throw new Error("Webinar attendance refresh failed");
          attendance.push(...page.data);
          if (page.data.length < 1000) break;
        }
        return { webinars: await notionWebinars(result.data), appointments, attendance };
      })(),
    ]);
    return NextResponse.json(
      {
        webinars: sessions?.webinars,
        appointments: sessions?.appointments,
        webinarAttendance: sessions?.attendance,
        crmApplications: crm.value?.applicationRows,
        crmApplicationsError: crm.error || crm.value?.applicationError || null,
        whopPayments: payments.value,
        whopHistoryError: payments.error,
        whopBalance: balance.value,
        whopBalanceError: balance.error,
        whopFetchedAt: payments.value ? new Date().toISOString() : undefined,
        crmPaymentStructures: crm.value?.rows,
        crmCash: crm.value?.cashRows,
        crmCallSnapshots: crm.value?.snapshots,
        crmAttribution: crm.value?.attributionRows,
        crmSnapshotError: crm.error || crm.value?.snapshotError || null,
        crmAttendance: crm.value?.attendanceRows,
        crmAttendanceError: crm.error || crm.value?.attendanceError || null,
        crmCashError: crm.error || crm.value?.cashError || null,
        crmStructuresFetchedAt: crm.value?.fetchedAt,
        crmStructuresError: crm.error || null,
        trakyoTransactions: trakyo.value,
        trakyoTransactionsError: trakyo.error,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Whop unavailable" },
      { status: 502, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
