import type { Dataset, WhopPayment } from "./model";
import { matchedContact } from "./payment-history";

export const structureLabels = [
  "Pay in Full (PIF)",
  "Manual Payment Plan",
  "Financing",
  "Unknown",
] as const;
export type Structure = (typeof structureLabels)[number];
export function normalizeStructure(
  value: string | null | undefined,
): Structure {
  const v = (value || "").trim().toLowerCase().replace(/[_-]+/g, " ");
  if (["pif", "pay in full (pif)", "pay in full"].includes(v))
    return "Pay in Full (PIF)";
  if (["two", "three", "custom", "manual payment plan"].includes(v))
    return "Manual Payment Plan";
  if (v === "financing") return "Financing";
  return "Unknown";
}
export const isCollected = (p: WhopPayment) =>
  p.status === "succeeded" || p.status === "refunded";
export function paymentStructure(
  data: Dataset,
  p: WhopPayment,
): { value: Structure; source: string } {
  if (
    (p.financing_installments || 0) > 0 ||
    ["klarna", "affirm", "afterpay", "sezzle"].includes(
      p.payment_method?.toLowerCase() || "",
    )
  )
    return { value: "Financing", source: "Whop financing method" };
  const saved = data.payments.find(
    (r) => r.provider === "whop" && r.external_payment_id === p.id,
  );
  const sale = data.sales.find(
    (s) =>
      s.id === saved?.sale_id ||
      (!!p.checkout_session_id && s.external_sale_id === p.checkout_session_id),
  );
  if (sale)
    return {
      value: normalizeStructure(sale.payment_type),
      source: "Saved agreement",
    };
  const contact = matchedContact(data, p);
  const crm =
    contact &&
    data.crmPaymentStructures?.find(
      (c) => c.ghl_contact_id === contact.ghl_contact_id,
    );
  return crm
    ? {
        value: normalizeStructure(crm.value),
        source: "Latest GHL contact field (not historical)",
      }
    : { value: "Unknown", source: "No verified plan classification" };
}
export function paymentAnalytics(
  data: Dataset,
  currency: string,
  from = "",
  to = "",
) {
  const all = (data.whopPayments || []).filter(
    (p) =>
      p.currency === currency &&
      (!from || (p.paid_at || p.created_at).slice(0, 10) >= from) &&
      (!to || (p.paid_at || p.created_at).slice(0, 10) <= to),
  );
  const paid = all.filter(isCollected);
  const gross = paid.reduce((s, p) => s + p.amount, 0),
    refunds = paid.reduce((s, p) => s + p.refunded, 0);
  const structures = structureLabels.map((label) => ({
    label,
    contacts: new Set(
      (data.crmPaymentStructures || [])
        .filter((c) => normalizeStructure(c.value) === label)
        .map((c) => c.ghl_contact_id),
    ).size,
    transactions: paid.filter((p) => paymentStructure(data, p).value === label)
      .length,
  }));
  const classified = structures
    .filter((s) => s.label !== "Unknown")
    .reduce((s, v) => s + v.transactions, 0);
  return {
    gross,
    refunds,
    net: gross - refunds,
    paid,
    attempts: all.length,
    structures,
    classified,
    pifRate: classified ? structures[0].transactions / classified : null,
  };
}
export function sameOrder(a: WhopPayment, b: WhopPayment) {
  // Never combine all payments for the same product/customer into one purchase.
  return (
    a.id === b.id ||
    (!!a.membership_id && a.membership_id === b.membership_id) ||
    (!!a.checkout_session_id && a.checkout_session_id === b.checkout_session_id)
  );
}
export function sameBuyer(data: Dataset, a: WhopPayment, b: WhopPayment) {
  if (a.user_id && b.user_id) return a.user_id === b.user_id;
  const ac = matchedContact(data, a),
    bc = matchedContact(data, b);
  return a.id === b.id || (!!ac && !!bc && ac.id === bc.id);
}
