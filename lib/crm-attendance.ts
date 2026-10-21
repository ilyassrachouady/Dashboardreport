import type { Dataset } from "./model";
export const attendanceStatuses = [
  "Attended",
  "No Show",
  "Cancelled",
  "Rescheduled",
  "Unrecognised",
] as const;
export function normalizeAttendance(
  value: string,
): (typeof attendanceStatuses)[number] {
  const v = value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
  if (["attended", "showed", "completed"].includes(v)) return "Attended";
  if (["no show", "noshow"].includes(v)) return "No Show";
  if (["cancelled", "canceled"].includes(v)) return "Cancelled";
  if (v === "rescheduled") return "Rescheduled";
  return "Unrecognised";
}
export function crmAttendanceRows(data: Dataset) {
  const unique = new Map(
    (data.crmAttendance || [])
      .filter((r) => r.value.trim())
      .map((r) => [r.ghl_contact_id, r]),
  );
  return [...unique.values()].map((r) => ({
    ...r,
    status: normalizeAttendance(r.value),
    contact: data.contacts.find((c) => c.ghl_contact_id === r.ghl_contact_id),
  }));
}
