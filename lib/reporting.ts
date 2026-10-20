import { reportingPayments } from "./payment-history";
import type { Dataset, Contact, Dimension, Filters, Touch } from "./model";
import { isBooked } from "./integrations/ghl-bookings";
export const ratio = (a: number, b: number) => (b ? a / b : null);
export const usd = (cents: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
export const percent = (n: number | null) =>
  n === null ? "—" : `${(n * 100).toFixed(1)}%`;
export function normalize(raw: string, dimension: Dimension, data: Dataset) {
  return (
    data.mappings.find((m) => m.dimension === dimension && m.raw_value === raw)
      ?.normalized_value ||
    raw ||
    "(not set)"
  );
}
export function touchFor(
  data: Dataset,
  id: string,
  model: "first" | "last",
  provider?: string,
): Touch | undefined {
  const touches = data.touches
    .filter(
      (t) => t.contact_id === id && (!provider || t.provider === provider),
    )
    .sort(
      (a, b) =>
        a.occurred_at.localeCompare(b.occurred_at) || a.id.localeCompare(b.id),
    );
  return model === "first" ? touches[0] : touches.at(-1);
}
export function dimensions(data: Dataset, id: string, filters: Filters) {
  const t = touchFor(data, id, filters.model);
  const reg = data.registrations
    .filter(
      (r) =>
        r.contact_id === id &&
        (!filters.webinar || r.webinar_id === filters.webinar),
    )
    .sort((a, b) => a.registered_at.localeCompare(b.registered_at))
    .at(filters.model === "first" ? 0 : -1);
  return Object.fromEntries(
    (["source", "medium", "campaign", "content"] as Dimension[]).map((k) => [
      k,
      normalize(t?.[k] || reg?.[`raw_utm_${k}`] || "", k, data),
    ]),
  ) as Record<Dimension, string>;
}
export const within = (date: string, f: Filters) =>
  Boolean(date) &&
  (!f.from || date.slice(0, 10) >= f.from) &&
  (!f.to || date.slice(0, 10) <= f.to);
// Acquisition-cohort reporting: date range selects registration date (or lead creation when unregistered).
// Downstream calls and revenue follow selected people, including later installment payments.
export function selectContacts(data: Dataset, f: Filters): Contact[] {
  return data.contacts.filter((c) => {
    const regs = data.registrations.filter(
      (r) =>
        r.contact_id === c.id && (!f.webinar || r.webinar_id === f.webinar),
    );
    if (f.webinar && !regs.length) return false;
    if (
      !(regs.length
        ? regs.some((r) => within(r.registered_at, f))
        : within(c.created_at, f))
    )
      return false;
    const d = dimensions(data, c.id, f),
      trak = touchFor(data, c.id, f.model, "trakyo");
    for (const k of ["source", "medium", "campaign", "content"] as Dimension[])
      if (f[k] && d[k] !== f[k]) return false;
    if (
      f.trakyoSource &&
      normalize(trak?.source || "", "source", data) !== f.trakyoSource
    )
      return false;
    if (
      f.trakyoCampaign &&
      normalize(trak?.campaign || "", "campaign", data) !== f.trakyoCampaign
    )
      return false;
    if (
      f.closer &&
      !data.calls.some((x) => x.contact_id === c.id && x.closer === f.closer) &&
      !data.appointments.some(
        (x) => x.contact_id === c.id && x.closer === f.closer,
      )
    )
      return false;
    if (
      f.offer &&
      !data.sales.some((s) => s.contact_id === c.id && s.offer === f.offer)
    )
      return false;
    return true;
  });
}
export function metrics(data: Dataset, contacts: Contact[], f?: Filters) {
  const ids = new Set(contacts.map((c) => c.id));
  const regs = data.registrations.filter(
    (r) =>
      ids.has(r.contact_id) &&
      (!f?.webinar || r.webinar_id === f.webinar) &&
      (!f || within(r.registered_at, f)),
  );
  const apps = data.appointments.filter(
    (a) =>
      ids.has(a.contact_id) &&
      (!f?.webinar || a.webinar_id === f.webinar) &&
      (!f?.closer || a.closer === f.closer),
  );
  const appIds = new Set(apps.map((a) => a.id));
  const calls = data.calls.filter(
    (c) =>
      ids.has(c.contact_id) &&
      (!f?.webinar ||
        Boolean(c.appointment_id && appIds.has(c.appointment_id))) &&
      (!f?.closer || c.closer === f.closer),
  );
  const attended = calls.filter((c) => c.attendance === "attended");
  const callIds = new Set(calls.map((c) => c.id));
  const sales = data.sales.filter(
    (s) =>
      ids.has(s.contact_id) &&
      (!f?.offer || s.offer === f.offer) &&
      (!(f?.webinar || f?.closer) ||
        Boolean(s.sales_call_id && callIds.has(s.sales_call_id))),
  );
  const saleIds = new Set(sales.map((s) => s.id));
  const entireAccount =
    ids.size === data.contacts.length &&
    (!f ||
      !Object.entries(f).some(
        ([key, value]) => key !== "model" && Boolean(value),
      ));
  const payments = reportingPayments(data).filter(
    (p) =>
      p.status === "succeeded" &&
      (p.sale_id
        ? saleIds.has(p.sale_id)
        : entireAccount || (ids.has(p.contact_id) && !f?.offer && !f?.closer)),
  );
  const contract = sales.reduce((n, s) => n + s.contract_value, 0),
    cash = payments.reduce((n, p) => n + p.amount, 0);
  return {
    leads: contacts.length,
    registrants: regs.length,
    booked: apps.filter((a) => isBooked(a.status)).length,
    attended: attended.length,
    sales: sales.length,
    contract,
    cash,
    show: ratio(attended.length, apps.filter((a) => isBooked(a.status)).length),
    close: ratio(sales.length, attended.length),
    rpr: ratio(contract, regs.length),
    cpc: ratio(
      payments
        .filter((p) => ids.has(p.contact_id))
        .reduce((sum, p) => sum + p.amount, 0),
      attended.length,
    ),
    salesConversion: ratio(sales.length, regs.length),
    regs,
    calls,
    saleRows: sales,
    paymentRows: payments,
  };
}
export function attribution(
  data: Dataset,
  contacts: Contact[],
  f: Filters,
  dimension: Dimension = "source",
  provider?: string,
) {
  const groups = new Map<string, Contact[]>();
  for (const c of contacts) {
    const t = provider ? touchFor(data, c.id, f.model, provider) : undefined;
    const name = provider
      ? normalize(t?.[dimension] || "", dimension, data)
      : dimensions(data, c.id, f)[dimension];
    groups.set(name, [...(groups.get(name) || []), c]);
  }
  return [...groups]
    .map(([name, cs]) => ({ name, ...metrics(data, cs, f) }))
    .sort((a, b) => b.cash - a.cash);
}
export function trend(data: Dataset, contacts: Contact[], f: Filters) {
  const m = metrics(data, contacts, f);
  const points = new Map<
    string,
    { date: string; registrations: number; sales: number; cash: number }
  >();
  const add = (
    date: string,
    key: "registrations" | "sales" | "cash",
    value: number,
  ) => {
    const d = date.slice(0, 10);
    const p = points.get(d) || { date: d, registrations: 0, sales: 0, cash: 0 };
    p[key] += value;
    points.set(d, p);
  };
  m.regs.forEach((r) => add(r.registered_at, "registrations", 1));
  m.saleRows.forEach((s) => add(s.sold_at, "sales", 1));
  m.paymentRows.forEach((p) => add(p.paid_at, "cash", p.amount / 100));
  return [...points.values()].sort((a, b) => a.date.localeCompare(b.date));
}
export function quality(data: Dataset) {
  const emailCounts = new Map<string, number>();
  data.contacts.forEach((c) => {
    if (c.email)
      emailCounts.set(
        c.email.toLowerCase(),
        (emailCounts.get(c.email.toLowerCase()) || 0) + 1,
      );
  });
  return {
    missingAttribution: data.contacts.filter(
      (c) =>
        !data.touches.some((t) => t.contact_id === c.id) &&
        !data.registrations.some(
          (r) => r.contact_id === c.id && r.raw_utm_source,
        ),
    ),
    missingEmail: data.contacts.filter((c) => !c.email),
    missingGhl: data.contacts.filter((c) => !c.ghl_contact_id),
    duplicates: data.contacts.filter(
      (c) => c.email && (emailCounts.get(c.email.toLowerCase()) || 0) > 1,
    ),
    unmapped: data.contacts.filter((c) =>
      data.touches.some(
        (t) =>
          t.contact_id === c.id &&
          t.source &&
          !data.mappings.some(
            (m) => m.dimension === "source" && m.raw_value === t.source,
          ),
      ),
    ),
  };
}
export function csv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]);
  const cell = (v: unknown) => {
    let s = String(v ?? "");
    if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  return [keys, ...rows.map((r) => keys.map((k) => r[k]))]
    .map((r) => r.map(cell).join(","))
    .join("\r\n");
}
