import type { Dataset } from "./model";
import { normalizeStructure } from "./payment-analytics";
import { normalizeAttendance } from "./crm-attendance";
export function crmPerformance(data: Dataset) {
  const rows = [
    ...new Map(
      (data.crmCallSnapshots || []).map((r) => [r.ghl_contact_id, r]),
    ).values(),
  ];
  const summarize = (items: typeof rows) => {
    const attended = items.filter(
      (r) => normalizeAttendance(r.attendance) === "Attended",
    );
    const sold = items.filter((r) => r.outcome.trim().toLowerCase() === "sold");
    const pif = items.filter(
      (r) => normalizeStructure(r.structure) === "Pay in Full (PIF)",
    ).length;
    const manual = items.filter(
      (r) => normalizeStructure(r.structure) === "Manual Payment Plan",
    ).length;
    const financing = items.filter(
      (r) => normalizeStructure(r.structure) === "Financing",
    ).length;
    const classified = pif + manual + financing;
    const cashRows = items.filter((r) => r.cashCents !== null),
      contracts = sold.filter((r) => r.contractCents !== null);
    const cash = cashRows.length
      ? cashRows.reduce((s, r) => s + r.cashCents!, 0)
      : null;
    return {
      contacts: items.length,
      attended: attended.length,
      sold: sold.length,
      pif,
      manual,
      financing,
      classified,
      pifRate: classified ? pif / classified : null,
      missingPlans: sold.filter(
        (r) => normalizeStructure(r.structure) === "Unknown",
      ).length,
      closeRate: attended.length
        ? attended.filter((r) => r.outcome.trim().toLowerCase() === "sold")
            .length / attended.length
        : null,
      cash,
      cashContacts: cashRows.length,
      contract: contracts.length
        ? contracts.reduce((s, r) => s + r.contractCents!, 0)
        : null,
      cashPerAttended:
        cash !== null && attended.length ? cash / attended.length : null,
    };
  };
  const closers = [...new Set(rows.map((r) => r.closer || "Unassigned"))].map(
    (closer) => ({
      closer,
      ...summarize(rows.filter((r) => (r.closer || "Unassigned") === closer)),
    }),
  );
  return { ...summarize(rows), closers };
}
