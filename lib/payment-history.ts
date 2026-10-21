import type { Dataset, WhopPayment, Payment } from "./model";
export function matchedContact(data: Dataset, p: WhopPayment) {
  const ghl = p.ghl_contact_id
    ? data.contacts.find((c) => c.ghl_contact_id === p.ghl_contact_id)
    : undefined;
  const email = p.email
    ? data.contacts.find(
        (c) => c.email?.toLowerCase() === p.email!.trim().toLowerCase(),
      )
    : undefined;
  const tx = (data.trakyoTransactions || []).filter(
    (t) => t.reference_number === p.id,
  );
  const leadIds = [...new Set(tx.map((t) => t.lead_id).filter(Boolean))];
  const trakyo =
    leadIds.length === 1
      ? data.contacts.find((c) => c.trakyo_id === leadIds[0])
      : undefined;
  const candidates = [ghl, email, trakyo].filter(Boolean);
  if (new Set(candidates.map((c) => c!.id)).size > 1) return undefined;
  return ghl || email || trakyo;
}
export function reportingPayments(data: Dataset): Payment[] {
  const payments = new Map(
    data.payments.map((p) => [`${p.provider}:${p.external_payment_id}`, p]),
  );
  for (const p of data.whopPayments || []) {
    if (p.currency !== "USD" || p.decimals !== 2) continue;
    const key = `whop:${p.id}`,
      existing = payments.get(key),
      contact = matchedContact(data, p);
    if (existing && contact && existing.contact_id !== contact.id)
      throw new Error("Whop payment contact conflict");
    const sale = p.checkout_session_id
      ? data.sales.find((s) => s.external_sale_id === p.checkout_session_id)
      : undefined;
    payments.set(key, {
      id: existing?.id || `whop:${p.id}`,
      provider: "whop",
      external_payment_id: p.id,
      contact_id: existing?.contact_id || contact?.id || "",
      sale_id:
        existing?.sale_id ||
        (sale && sale.contact_id === contact?.id ? sale.id : null),
      amount: p.net,
      status: p.status,
      paid_at: p.paid_at || p.created_at,
    });
  }
  return [...payments.values()];
}
