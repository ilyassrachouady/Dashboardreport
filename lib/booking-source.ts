import type { Appointment, Webinar } from "./model";
export type BookingSource = "live" | "replay" | "followup";
export interface BookingEvidence {
  appointmentId: string;
  contactId: string;
  locationId: string;
  eventId: string;
  contentId: string;
}
export interface BookingSourceRule { webinarId: string; contentId: string; source: BookingSource }
// Only explicit booking events qualify. Clicks and a contact's current last touch
// cannot establish which placement generated a particular appointment.
export function bookingEvidence(raw: unknown): BookingEvidence | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Record<string, any>;
  if (e.type !== "ghl_booking") return null;
  const values = [e.data?.calendar?.appointmentId, e.data?.contact_id, e.data?.location?.id, e.id, e.content?.item_id];
  if (!values.every(v => typeof v === "string" && v.trim())) return null;
  return { appointmentId: values[0], contactId: values[1], locationId: values[2], eventId: values[3], contentId: values[4] };
}
export function matchBookingSource(appointmentId: string, contactId: string, locationId: string, evidence: BookingEvidence[], rules: BookingSourceRule[]) {
  const matches = evidence.filter(e => e.appointmentId === appointmentId && e.contactId === contactId && e.locationId === locationId);
  if (!matches.length) return null;
  const candidates = matches.map(e => ({ e, rules: rules.filter(r => r.contentId === e.contentId) }));
  // Shared links between sessions or conflicting booking snapshots stay unknown.
  if (candidates.some(c => c.rules.length !== 1)) return null;
  const [first] = candidates;
  if (candidates.some(c => c.rules[0].webinarId !== first.rules[0].webinarId || c.rules[0].source !== first.rules[0].source)) return null;
  return { webinar_id: first.rules[0].webinarId, booking_source: first.rules[0].source, booking_source_event_id: first.e.eventId };
}
export function bookingSourceCounts(appointments: Appointment[], webinar: Webinar) {
  const rows = appointments.filter(a => a.webinar_id === webinar.id && !["cancelled", "canceled", "invalid", "deleted"].includes(a.status.toLowerCase()));
  // Count a person once. If their bookings span both placements, show them as
  // unclassified instead of counting the same person in both cards.
  const people = new Map<string, Set<string>>();
  for (const row of rows) {
    const sources = people.get(row.contact_id) || new Set<string>();
    sources.add(row.booking_source || "unknown"); people.set(row.contact_id, sources);
  }
  let live = 0, after = 0, unknown = 0;
  for (const sources of people.values()) {
    if (sources.size === 1 && sources.has("live")) live++;
    else if ([...sources].every(s => s === "replay" || s === "followup")) after++;
    else unknown++;
  }
  return { live, after, unknown, total: people.size };
}
