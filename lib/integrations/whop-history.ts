import { z } from "zod";
import type { WhopPayment } from "../model";
const amount = z.object({
  currency: z.string(),
  amount: z.string(),
  decimals: z.number().int().min(0).max(4),
});
export function minorAmount(raw: unknown): number {
  const v = amount.parse(raw);
  const match = /^(\d+)(?:\.(\d+))?$/.exec(v.amount);
  if (!match) throw new Error("Invalid Whop amount");
  const fractional = match[2] || "";
  if (
    fractional.length > v.decimals &&
    /[1-9]/.test(fractional.slice(v.decimals))
  )
    throw new Error("Whop amount precision mismatch");
  const n =
    Number(match[1]) * 10 ** v.decimals +
    Number(fractional.slice(0, v.decimals).padEnd(v.decimals, "0"));
  if (!Number.isSafeInteger(n)) throw new Error("Whop amount out of range");
  return n;
}
export function adaptWhopPayment(raw: unknown, accountId: string): WhopPayment {
  const p = z
    .object({
      id: z.string(),
      account_id: z.string(),
      status: z.string(),
      substatus: z.string(),
      currency: z.string(),
      total: amount,
      usd_total: amount.nullish(),
      presentment_total: amount.nullish(),
      refunded_amount: amount.nullish(),
      paid_at: z.string().nullish(),
      created_at: z.string(),
      user: z.object({ id: z.string(), name: z.string().nullish() }).nullish(),
      customer_email: z.string().nullish(),
      member_id: z.string().nullish(),
      membership_id: z.string().nullish(),
      plan_id: z.string().nullish(),
      product_id: z.string().nullish(),
      payment_method_type: z.string().nullish(),
      billing_reason: z.string().nullish(),
      financing_installments_count: z.number().int().nullish(),
      metadata: z.record(z.string(), z.unknown()).nullish(),
    })
    .parse(raw);
  if (p.account_id !== accountId || p.total.currency !== p.currency)
    throw new Error("Whop account/currency mismatch");
  if (
    !Number.isFinite(Date.parse(p.created_at)) ||
    (p.paid_at && !Number.isFinite(Date.parse(p.paid_at)))
  )
    throw new Error("Invalid Whop payment date");
  const refunded = p.refunded_amount ? minorAmount(p.refunded_amount) : 0,
    total = minorAmount(p.total);
  if (
    refunded > total ||
    (p.refunded_amount && p.refunded_amount.currency !== p.currency)
  )
    throw new Error("Invalid Whop refund");
  if (p.status === "paid" && p.substatus === "succeeded" && !p.paid_at)
    throw new Error("Successful Whop payment is missing paid_at");
  const meta = p.metadata || {};
  if (
    p.usd_total &&
    (p.usd_total.currency !== "usd" || p.usd_total.decimals !== 2)
  )
    throw new Error("Invalid Whop USD conversion");
  return {
    usd_amount: p.usd_total
      ? minorAmount(p.usd_total)
      : p.currency === "usd"
        ? total
        : null,
    presentment: p.presentment_total
      ? {
          currency: p.presentment_total.currency.toUpperCase(),
          amount: minorAmount(p.presentment_total),
          decimals: p.presentment_total.decimals,
        }
      : null,
    user_id: p.user?.id || null,
    membership_id: p.membership_id || null,
    plan_id: p.plan_id || null,
    product_id: p.product_id || null,
    payment_method: p.payment_method_type || null,
    billing_reason: p.billing_reason || null,
    financing_installments: p.financing_installments_count || null,
    id: p.id,
    currency: p.currency.toUpperCase(),
    decimals: p.total.decimals,
    amount: total,
    refunded,
    net: total - refunded,
    status:
      refunded === total && refunded > 0
        ? "refunded"
        : p.status === "paid" && p.substatus === "succeeded"
          ? "succeeded"
          : ["failed", "blocked"].includes(p.substatus)
            ? "failed"
            : "pending",
    paid_at: p.paid_at || null,
    created_at: p.created_at,
    customer_name: p.user?.name || "Whop customer",
    ghl_contact_id:
      typeof meta.ghl_contact_id === "string" ? meta.ghl_contact_id : null,
    email:
      typeof meta.email === "string" ? meta.email : p.customer_email || null,
    checkout_session_id:
      typeof meta.checkout_session_id === "string"
        ? meta.checkout_session_id
        : null,
  };
}
export async function fetchWhopHistory(): Promise<WhopPayment[]> {
  const key = process.env.WHOP_API_KEY,
    account = process.env.WHOP_COMPANY_ID;
  if (!key || !account)
    throw new Error("Configure WHOP_API_KEY and WHOP_COMPANY_ID");
  const host =
    process.env.WHOP_SANDBOX === "true"
      ? "https://sandbox-api.whop.com"
      : "https://api.whop.com";
  const results = new Map<string, WhopPayment>();
  const cursors = new Set<string>();
  let after: string | undefined;
  for (let page = 0; page < 100; page++) {
    const url = new URL(host + "/api/v1/payments");
    url.searchParams.set("account_id", account);
    url.searchParams.set("first", "100");
    if (after) url.searchParams.set("after", after);
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(20000),
      cache: "no-store",
    });
    if (!r.ok)
      throw new Error(
        `Whop history unavailable (${r.status}). Check payment read permissions.`,
      );
    const body = z
      .object({
        data: z.array(z.unknown()),
        page_info: z.object({
          has_next_page: z.boolean(),
          end_cursor: z.string().nullable(),
        }),
      })
      .parse(await r.json());
    for (const raw of body.data) {
      const p = adaptWhopPayment(raw, account);
      if (results.has(p.id))
        throw new Error("Repeated Whop payment across history pages; retry");
      results.set(p.id, p);
    }
    if (!body.page_info.has_next_page) return [...results.values()];
    after = body.page_info.end_cursor || undefined;
    if (!after || cursors.has(after))
      throw new Error("Invalid Whop history cursor");
    cursors.add(after);
  }
  throw new Error("Whop history batch limit reached; refusing partial results");
}
