import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import { eventSchema, type IngestionEvent } from "./schema";
type Row = Record<string, unknown>;
async function rows(db: SupabaseClient<any, "public", string>, table: string) {
  const all: Row[] = [];
  for (let start = 0; start < 100000; start += 1000) {
    const r = await db
      .from(table)
      .select("*")
      .order("id")
      .range(start, start + 999);
    if (r.error) throw new Error(`Payment Desk ${table} read failed`);
    all.push(...r.data);
    if (r.data.length < 1000) return all;
  }
  throw new Error("Payment Desk batch limit reached");
}
export function paymentDeskEvents(
  contacts: Row[],
  calls: Row[],
  sessions: Row[],
  payments: Row[],
): IngestionEvent[] {
  const events: IngestionEvent[] = [];
  const identity = (c: Row) => ({
    ghl_contact_id: String(c.ghl_contact_id),
    ...(c.email ? { email: String(c.email).trim().toLowerCase() } : {}),
    first_name: String(c.full_name || "").split(" ")[0] || "",
    last_name: String(c.full_name || "")
      .split(" ")
      .slice(1)
      .join(" "),
  });
  for (const c of calls) {
    if (c.mode !== "live") continue;
    const contact = contacts.find((p) => p.ghl_contact_id === c.ghl_contact_id);
    if (!contact) continue;
    const raw = {
      provider: "whop",
      event_id: `desk-call:${c.id}`,
      contact: identity(contact),
      calls: [
        {
          external_id: `desk:${c.id}`,
          call_date: c.created_at,
          closer: c.closer_name,
          attendance: c.attendance,
          outcome: c.outcome,
          recording_url: String(c.notes || "").match(
            /(?:^|\n)Call recording: (https:\/\/[^\s]+)/,
          )?.[1],
        },
      ],
    };
    events.push(eventSchema.parse(raw));
  }
  for (const s of sessions) {
    if (s.mode !== "live") continue;
    const meta = (s.metadata || {}) as Row,
      contact = contacts.find((p) => p.ghl_contact_id === meta.ghl_contact_id);
    if (!contact) continue;
    const call = calls.find(
      (c) =>
        c.checkout_session_id === s.id && c.outcome === "sold" && c.mode === "live",
    );
    const receipts = payments.filter(
      (p) => p.checkout_session_id === s.id && p.payment_status === "succeeded",
    );
    // Never turn a generated checkout or a deposit into a closed sale.
    if (s.checkout_type === "deposit" || s.payment_type === null) continue;
    if (!call && !receipts.length) continue;
    const sale = {
      external_id: String(s.id),
      ...(call ? { call_external_id: `desk:${call.id}` } : {}),
      offer: String(meta.offer_name || "Unmapped offer"),
      payment_type: String(s.payment_type),
      contract_value: Number(s.contract_value),
      sold_at: String(call?.created_at || receipts[0]?.paid_at || s.created_at),
    };
    // Each payment is its own provider-keyed event, so later installments append without replaying a mutated call event.
    const saleEvent = {
      provider: "whop",
      event_id: `desk-sale:${s.id}`,
      contact: identity(contact),
      sales: [sale],
    };
    events.push(eventSchema.parse(saleEvent));
    for (const p of receipts)
      events.push(
        eventSchema.parse({
          provider: "whop",
          event_id: `desk-payment:${p.whop_payment_id}`,
          contact: identity(contact),
          payments: [
            {
              external_payment_id: String(p.whop_payment_id),
              sale_external_id: String(s.id),
              amount: Number(p.amount_collected),
              currency: "USD",
              status: "succeeded",
              paid_at: String(p.paid_at),
            },
          ],
        }),
      );
  }
  return events;
}
export async function fetchPaymentDeskEvents() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
    throw new Error("Configure Supabase");
  const db = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false },
      db: { schema: process.env.PAYMENT_DESK_SCHEMA || "payment_desk" },
    },
  );
  const [contacts, calls, sessions, payments] = await Promise.all(
    ["prospects", "call_records", "checkout_sessions", "payments"].map((t) =>
      rows(db, t),
    ),
  );
  return paymentDeskEvents(contacts, calls, sessions, payments);
}
