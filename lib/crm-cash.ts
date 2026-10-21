import type { Dataset } from "./model";

export function crmCashCents(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(value).trim());
  if (!match) return null;
  const cents =
    Number(match[1]) * 100 + Number((match[2] || "").padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}
export function crmCloserCash(data: Dataset) {
  if (data.crmCallSnapshots !== undefined) {
    const rows = [
      ...new Map(
        data.crmCallSnapshots.map((r) => [r.ghl_contact_id, r]),
      ).values(),
    ];
    const entries = rows.flatMap((r) => {
      const contact = data.contacts.find(
        (c) => c.ghl_contact_id === r.ghl_contact_id,
      );
      if (!contact || r.cashCents === null || data.crmCashError) return [];
      const latest = data.calls
        .filter((c) => c.contact_id === contact.id)
        .sort(
          (a, b) =>
            b.call_date.localeCompare(a.call_date) || b.id.localeCompare(a.id),
        )[0];
      return [
        {
          contactId: contact.id,
          callId: latest?.id || "",
          closer: r.closer || "Unassigned",
          cash: r.cashCents,
        },
      ];
    });
    return {
      entries,
      total: entries.length ? entries.reduce((s, r) => s + r.cash, 0) : null,
      contacts: entries.length,
    };
  }
  const latest = new Map<string, Dataset["calls"][number]>();
  for (const call of data.calls) {
    const previous = latest.get(call.contact_id);
    if (
      !previous ||
      call.call_date > previous.call_date ||
      (call.call_date === previous.call_date && call.id > previous.id)
    )
      latest.set(call.contact_id, call);
  }
  const entries = [...latest].flatMap(([contactId, call]) => {
    const contact = data.contacts.find((c) => c.id === contactId);
    const cash =
      contact &&
      data.crmCash?.find((c) => c.ghl_contact_id === contact.ghl_contact_id);
    return cash?.cashCents != null && !data.crmCashError
      ? [
          {
            contactId,
            callId: call.id,
            closer: call.closer.trim() || "Unassigned",
            cash: cash.cashCents,
          },
        ]
      : [];
  });
  return {
    entries,
    total: entries.length ? entries.reduce((s, v) => s + v.cash, 0) : null,
    contacts: entries.length,
  };
}
