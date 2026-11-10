import { z } from "zod";
import { attendanceFlag } from "./provider-attendance";
import {
  reconcileRegistrantSchedules,
  webinarTimestamp,
} from "./integrations/webinars";
import { sourceMapping } from "./source-normalization";

const contact = z.object({
  id: z.string(),
  locationId: z.string(),
  email: z.string().nullish(),
  tags: z.array(z.string()).default([]),
  customFields: z
    .array(z.object({ id: z.string(), value: z.unknown() }))
    .default([]),
});
const testTags = new Set(["test", "qa", "test-registration", "internal-test"]);
const registration = z
  .object({
    id: z.union([z.string(), z.number()]),
    email: z.string().email(),
    schedule_id: z.union([z.string(), z.number()]),
    event_id: z.union([z.string(), z.number()]).nullish(),
    signup_date: z.string(),
    first_name: z.string().nullish(),
    last_name: z.string().nullish(),
    attended_live: z.unknown().optional(),
    attended_replay: z.unknown().optional(),
    utm_source: z.unknown().optional(),
  })
  .passthrough();
export interface UgcEvent {
  pageId: string;
  name: string;
  webinar_date: string;
  webinar_ended_at?: string | null;
  peak_attendees: number | null;
  pitch_attendees: number | null;
  notion_page_url?: string | null;
  notion_updated_at?: string;
}
export interface UgcSessionReport {
  id: string;
  code: string;
  name: string;
  startsAt: string;
  endsAt: string | null;
  notionUrl: string | null;
  registrants: number;
  registrationRecords: number;
  crmMatched: number;
  bookedContacts: number | null;
  attendeeBookings: number | null;
  bookingRate: number | null;
  crmUnmatched: number;
  liveAttendees: number | null;
  replayAttendees: number | null;
  peak: number | null;
  pitch: number | null;
  attendanceRate: number | null;
  retentionRate: number | null;
  sources: { name: string; count: number }[];
  registrationDays: { date: string; count: number }[];
  issues: string[];
}
export interface UgcReport {
  client: "ugc";
  locationId: string;
  checkedAt: string;
  sessions: UgcSessionReport[];
  crmContacts: number;
  unmappedSchedules: number;
}
export type UgcProvider = {
  details: {
    webinar_id: string | number;
    name: string;
    timezone: string;
    schedules: { date: string; schedule: string | number }[];
  };
  registrants: unknown[];
};
export function buildUgcReport(input: {
  locationId: string;
  contacts: unknown[];
  fields: { id: string; fieldKey: string }[];
  events: UgcEvent[];
  providers: UgcProvider[];
  now?: number;
  testEmails?: string[];
}): UgcReport {
  const now = input.now ?? Date.now(),
    contacts = input.contacts.map((c) => contact.parse(c));
  if (
    !input.locationId ||
    contacts.some((c) => c.locationId !== input.locationId)
  )
    throw Error("UGC CRM account identity mismatch.");
  if (new Set(contacts.map((c) => c.id)).size !== contacts.length)
    throw Error("Duplicate CRM contacts in the API snapshot.");
  const email = (s: string) => s.trim().toLowerCase();
  const testEmails = new Set(input.testEmails?.map(email));
  const byEmail = new Map<string, z.infer<typeof contact>[]>();
  for (const c of contacts)
    if (c.email) {
      const key = email(c.email);
      byEmail.set(key, [...(byEmail.get(key) || []), c]);
    }
  const sourceFields = input.fields.filter(
    (f) => f.fieldKey === "contact.utm_source",
  );
  if (sourceFields.length > 1) throw Error("Ambiguous UGC source field.");
  const bookingFields = input.fields.filter(f => f.fieldKey === "contact.appointment_booked");
  const bookingField = bookingFields.length === 1 ? bookingFields[0].id : undefined;
  const schedules = input.providers.flatMap((p) =>
    p.details.schedules.map((s) => ({
      provider: p,
      schedule: s,
      at: webinarTimestamp(s.date, p.details.timezone),
    })),
  );
  const sorted = [...input.events].sort(
    (a, b) =>
      a.webinar_date.localeCompare(b.webinar_date) ||
      a.pageId.localeCompare(b.pageId),
  );
  if (new Set(sorted.map((e) => e.webinar_date)).size !== sorted.length)
    throw Error(
      "Multiple UGC Notion events share a start time; map them explicitly before importing.",
    );
  const sessions = sorted.map((event, index) => {
    const matches = schedules.filter(
      (s) => Date.parse(s.at) === Date.parse(event.webinar_date),
    );
    if (matches.length !== 1)
      throw Error(
        `UGC event ${event.name} has no unique matching WebinarJam schedule. Check its start time.`,
      );
    const { provider, schedule } = matches[0];
    const rows = reconcileRegistrantSchedules(
      provider.details,
      provider.registrants,
    )
      .map((r) => registration.parse(r))
      .filter((r) => String(r.schedule_id) === String(schedule.schedule));
    const occurrences = new Set(
      rows.filter((r) => r.event_id != null).map((r) => String(r.event_id)),
    );
    if (occurrences.size > 1)
      throw Error("UGC schedule contains conflicting event IDs.");
    const people = new Map<string, typeof rows>();
    for (const r of rows) {
      const key = email(r.email);
      const name = [r.first_name, r.last_name].filter(Boolean).join(" ");
      const candidates = byEmail.get(key);
      if (testEmails.has(key) || /\b(?:test|qa)\b/i.test(name) ||
          (candidates?.length === 1 && candidates[0].tags.some(tag => testTags.has(tag.trim().toLowerCase())))) continue;
      people.set(key, [...(people.get(key) || []), r]);
    }
    const sources = new Map<string, number>(),
      days = new Map<string, number>();
    let matched = 0,
      booked = 0,
      liveBooked = 0,
      live = 0,
      replay = 0,
      liveKnown = true,
      replayKnown = true;
    for (const [key, registrations] of people) {
      const candidates = byEmail.get(key) || [];
      let hasBooking = false;
      if (candidates.length === 1) {
        matched++;
        const flag = candidates[0].customFields.find(field => field.id === bookingField)?.value;
        hasBooking = typeof flag === "string" && flag.trim().toLowerCase() === "yes";
        if (hasBooking) booked++;
      }
      const providerSources = [
        ...new Set(
          registrations
            .map((r) =>
              typeof r.utm_source === "string" ? r.utm_source.trim() : "",
            )
            .filter(Boolean),
        ),
      ];
      const crmSource =
        candidates.length === 1 && sourceFields[0]
          ? candidates[0].customFields.find((f) => f.id === sourceFields[0].id)
              ?.value
          : undefined;
      const raw =
        providerSources.length === 1
          ? providerSources[0]
          : providerSources.length > 1
            ? ""
            : typeof crmSource === "string"
              ? crmSource.trim()
              : "";
      const source = raw
        ? sourceMapping(raw)?.normalized_value || raw
        : "Unattributed";
      sources.set(source, (sources.get(source) || 0) + 1);
      const first = registrations
        .map((r) => webinarTimestamp(r.signup_date, provider.details.timezone))
        .sort()[0]
        .slice(0, 10);
      days.set(first, (days.get(first) || 0) + 1);
      const flags = (key: "attended_live" | "attended_replay") =>
        registrations.map((r) => attendanceFlag(r[key]));
      const lf = flags("attended_live"),
        rf = flags("attended_replay");
      if (lf.includes(true)) {
        live++;
        if (hasBooking) liveBooked++;
      }
      else if (!lf.includes(false)) liveKnown = false;
      if (rf.includes(true)) replay++;
      else if (!rf.includes(false)) replayKnown = false;
    }
    const issues: string[] = [];
    if (event.peak_attendees != null && event.peak_attendees > people.size)
      issues.push("Peak attendance exceeds unique registrants.");
    if (
      event.pitch_attendees != null &&
      event.peak_attendees != null &&
      event.pitch_attendees > event.peak_attendees
    )
      issues.push("Pitch audience exceeds peak audience.");
    const attendeeBookings = bookingField && liveKnown && live > 0 && now >= Date.parse(event.webinar_date) ? liveBooked : null;
    const pitch = event.pitch_attendees;
    return {
      id: `ugc:${provider.details.webinar_id}:${schedule.schedule}:${[...occurrences][0] || schedule.date}`,
      code: `QUE${String(index + 1).padStart(3, "0")}`,
      name: event.name || provider.details.name,
      startsAt: event.webinar_date,
      endsAt: event.webinar_ended_at || null,
      notionUrl: event.notion_page_url || null,
      registrants: people.size,
      registrationRecords: rows.length,
      crmMatched: matched,
      bookedContacts: bookingField ? booked : null,
      attendeeBookings,
      bookingRate: attendeeBookings != null && pitch != null && pitch > 0 && attendeeBookings <= pitch ? attendeeBookings / pitch : null,
      crmUnmatched: people.size - matched,
      liveAttendees:
        now >= Date.parse(event.webinar_date) && people.size > 0 && liveKnown
          ? live
          : null,
      replayAttendees:
        now >= Date.parse(event.webinar_date) && people.size > 0 && replayKnown
          ? replay
          : null,
      peak: event.peak_attendees,
      pitch: event.pitch_attendees,
      attendanceRate:
        event.peak_attendees != null &&
        people.size > 0 &&
        event.peak_attendees <= people.size
          ? event.peak_attendees / people.size
          : null,
      retentionRate:
        event.pitch_attendees != null &&
        event.peak_attendees != null &&
        event.peak_attendees > 0 &&
        event.pitch_attendees <= event.peak_attendees
          ? event.pitch_attendees / event.peak_attendees
          : null,
      sources: [...sources]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
      registrationDays: [...days]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, count]) => ({ date, count })),
      issues,
    };
  });
  return {
    client: "ugc",
    locationId: input.locationId,
    checkedAt: new Date(now).toISOString(),
    sessions,
    crmContacts: contacts.length,
    unmappedSchedules: schedules.filter(
      (s) =>
        !sorted.some((e) => Date.parse(e.webinar_date) === Date.parse(s.at)),
    ).length,
  };
}
