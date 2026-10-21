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
    const [payments, crm, trakyo, balance] = await Promise.all([
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
    ]);
    return NextResponse.json(
      {
        whopPayments: payments.value,
        whopHistoryError: payments.error,
        whopBalance: balance.value,
        whopBalanceError: balance.error,
        whopFetchedAt: payments.value ? new Date().toISOString() : undefined,
        crmPaymentStructures: crm.value?.rows,
        crmStructuresFetchedAt: crm.value?.fetchedAt,
        crmStructuresError: crm.error,
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
