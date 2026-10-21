import "server-only";
import { unstable_cache } from "next/cache";
import { z } from "zod";
import { fetchGhlContacts, fetchGhlFieldMap } from "./ghl";
import { crmCashCents } from "../crm-cash";
import type { Dataset } from "../model";

// Current contact-level classification; never presented as historical agreement data.
export async function fetchCrmPaymentStructures(location: string) {
  if (location !== process.env.GHL_LOCATION_ID)
    throw new Error("GHL location mismatch");
  const fields = await fetchGhlFieldMap();
  const ids = [
    ...new Set(
      [
        fields.payment_structure,
        fields.cash_collected,
        fields.attendance,
        fields.call_outcome,
        fields.closer,
        fields.agreed_total_investment,
      ].filter(Boolean),
    ),
  ];
  const groups = await Promise.all(ids.map((id) => fetchGhlContacts(id)));
  const contacts = [
    ...new Map(
      groups.flat().map((raw) => {
        const c = z.object({ id: z.string() }).parse(raw);
        return [c.id, raw] as const;
      }),
    ).values(),
  ];
  if (!fields.payment_structure)
    throw new Error("GHL Payment Structure field is missing");
  const cashRows: { ghl_contact_id: string; cashCents: number | null }[] = [];
  const attendanceRows: { ghl_contact_id: string; value: string }[] = [];
  const snapshots: NonNullable<Dataset["crmCallSnapshots"]> = [];
  const rows = contacts.flatMap((raw) => {
    const c = z
      .object({
        id: z.string(),
        locationId: z.string(),
        customFields: z
          .array(z.object({ id: z.string(), value: z.unknown() }))
          .optional(),
      })
      .parse(raw);
    if (c.locationId !== location) throw new Error("GHL location mismatch");
    const get = (key: string) =>
      c.customFields?.find((f) => f.id === fields[key])?.value;
    const text = (key: string) =>
      typeof get(key) === "string" ? String(get(key)).trim() : "";
    snapshots.push({
      ghl_contact_id: c.id,
      closer: text("closer"),
      attendance: text("attendance"),
      outcome: text("call_outcome"),
      structure: text("payment_structure"),
      cashCents: crmCashCents(get("cash_collected")),
      contractCents: crmCashCents(get("agreed_total_investment")),
    });
    const attendance = c.customFields?.find(
      (f) => f.id === fields.attendance,
    )?.value;
    if (typeof attendance === "string" && attendance.trim())
      attendanceRows.push({ ghl_contact_id: c.id, value: attendance.trim() });
    const cash = c.customFields?.find(
      (f) => f.id === fields.cash_collected,
    )?.value;
    if (cash !== undefined && cash !== null && cash !== "")
      cashRows.push({ ghl_contact_id: c.id, cashCents: crmCashCents(cash) });
    const value = c.customFields?.find(
      (f) => f.id === fields.payment_structure,
    )?.value;
    return typeof value === "string" && value.trim()
      ? [{ ghl_contact_id: c.id, value: value.trim() }]
      : [];
  });
  return {
    rows,
    snapshots,
    snapshotError: [
      "attendance",
      "call_outcome",
      "closer",
      "agreed_total_investment",
      "cash_collected",
      "payment_structure",
    ].some((k) => !fields[k])
      ? "Some required GHL reporting fields are missing"
      : undefined,
    attendanceRows: fields.attendance ? attendanceRows : undefined,
    attendanceError: fields.attendance
      ? undefined
      : "GHL Attendance field is missing",
    cashRows: fields.cash_collected ? cashRows : undefined,
    cashError: fields.cash_collected
      ? undefined
      : "GHL Cash Collected field is missing",
    fetchedAt: new Date().toISOString(),
  };
}

export const fetchTrakyoTransactions = unstable_cache(
  async () => {
    if (!process.env.TRAKYO_API_KEY)
      throw new Error("Trakyo is not configured");
    const row = z.object({
      id: z.string(),
      lead_id: z.string().nullable(),
      reference_number: z.string().nullable(),
      transaction_date: z.string(),
      payment_method: z.string().nullable(),
    });
    const results: z.infer<typeof row>[] = [],
      ids = new Set<string>(),
      cursors = new Set<string>();
    let cursor: string | undefined;
    for (let page = 0; page < 200; page++) {
      const url = new URL("https://api.trakyo.io/v1/transactions");
      url.searchParams.set("type", "whop_payment");
      url.searchParams.set("limit", "500");
      if (cursor) url.searchParams.set("starting_after", cursor);
      const r = await fetch(url, {
        headers: { Authorization: `Bearer ${process.env.TRAKYO_API_KEY}` },
        signal: AbortSignal.timeout(20000),
        cache: "no-store",
      });
      if (!r.ok)
        throw new Error(
          r.status === 403
            ? "Trakyo needs transactions:read permission"
            : "Trakyo transaction history unavailable",
        );
      const b = z
        .object({
          data: z.array(row),
          has_more: z.boolean(),
          next_cursor: z.string().nullable(),
        })
        .parse(await r.json());
      for (const item of b.data) {
        if (ids.has(item.id)) throw new Error("Repeated Trakyo transaction");
        ids.add(item.id);
        results.push(item);
      }
      if (!b.has_more) return results;
      if (!b.next_cursor || cursors.has(b.next_cursor))
        throw new Error("Invalid Trakyo transaction cursor");
      cursor = b.next_cursor;
      cursors.add(cursor);
    }
    throw new Error("Trakyo transaction batch limit reached");
  },
  ["trakyo-whop-transactions-v1"],
  { revalidate: 300 },
);
