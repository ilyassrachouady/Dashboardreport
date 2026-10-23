import "server-only";
import { syncNotionCounts } from "./integrations/notion";
import { fetchBookingSources } from "./integrations/booking-sources";
import { matchBookingSource } from "./booking-source";
import { database } from "./db";
import {
  bookingWebinar,
  fetchGhlBookings,
  isBooked,
} from "./integrations/ghl-bookings";
import { webinarTagMap } from "./integrations/ghl-webinar";
import { adaptGhlContact } from "./integrations/ghl";
export async function syncBookings(
  contacts: unknown[],
  fields: Record<string, string>,
) {
  const db = database();
  const webinars = await db
    .from("webinars")
    .select("*");
  if (webinars.error) throw new Error("Cannot load webinar sessions");
  const sessions = webinars.data;
  const start =
    Math.min(
      Date.now() - 90 * 86400000,
      ...sessions.map((w) => Date.parse(w.webinar_date)),
    ) - 86400000;
  const end = Date.now() + 90 * 86400000;
  const events = await fetchGhlBookings(start, end);
  const people = new Map(
    contacts.map((raw) => {
      const c = raw as {
        id: string;
        tags?: string[];
        customFields?: Array<{ id: string; value: unknown }>;
        email?: string | null;
      };
      return [c.id, c];
    }),
  );
  const stored = [];
  for (let offset = 0; ; offset += 1000) {
    const r = await db
      .from("contacts")
      .select("id,ghl_contact_id,email")
      .order("id")
      .range(offset, offset + 999);
    if (r.error) throw new Error("Cannot read reporting contacts");
    stored.push(...r.data);
    if (r.data.length < 1000) break;
  }
  const identities = new Map(
    stored.filter((c) => c.ghl_contact_id).map((c) => [c.ghl_contact_id, c.id]),
  );
  for (const id of new Set(events.map((e) => e.contactId))) {
    if (identities.has(id)) continue;
    const raw = contacts.find((raw) => (raw as { id: string }).id === id);
    if (!raw)
      throw new Error(
        "Calendar contact is absent from the CRM contact snapshot",
      );
    const payload = adaptGhlContact(raw, process.env.GHL_LOCATION_ID!, fields);
    const imported = await db.rpc("ingest_contact_event", { payload });
    if (imported.error)
      throw new Error("Booking contact identity needs review");
    const linked = await db
      .from("contacts")
      .select("id,ghl_contact_id,email")
      .eq("ghl_contact_id", id)
      .single();
    if (linked.error) throw new Error("Booking contact could not be linked");
    stored.push(linked.data);
    identities.set(id, linked.data.id);
  }
  const registeredSessions = new Map<string, Set<string>>();
  const emails = new Map(stored.map(c => [c.id, c.email?.trim().toLowerCase()]));
  for (let offset = 0; ; offset += 1000) {
    const page = await db.from("webinar_registrations").select("id,contact_id,webinar_id").order("id").range(offset,offset+999);
    if (page.error) throw new Error("Cannot verify webinar registration email matches");
    for (const row of page.data) {
      const email = emails.get(row.contact_id);
      if (!email) continue;
      const matched = registeredSessions.get(email) || new Set<string>();
      matched.add(row.webinar_id); registeredSessions.set(email,matched);
    }
    if (page.data.length < 1000) break;
  }
  const map = webinarTagMap(sessions);
  const sources = await fetchBookingSources(sessions);
  const sourceSchema = await db.from("appointments").select("booking_source").limit(0);
  const sourceColumnsAvailable = !sourceSchema.error;
  if (sourceSchema.error && !/booking_source/.test(sourceSchema.error.message)) throw new Error("Cannot check booking source storage");
  if (!sourceColumnsAvailable && sources.rules.length) throw new Error("Apply migration 006 before syncing webinar booking sources");
  const rows = events.map((e) => {
    const contactId = identities.get(e.contactId),
      person = people.get(e.contactId);
    if (!contactId || !person)
      throw new Error(
        "Booking contact missing from reporting; run GHL contact sync first",
      );
    const source = matchBookingSource(e.id, e.contactId, process.env.GHL_LOCATION_ID!, sources.evidence, sources.rules);
    return {
      ...(sourceColumnsAvailable ? { booking_source: source?.booking_source ?? null, booking_source_event_id: source?.booking_source_event_id ?? null } : {}),
      contact_id: contactId,
      ghl_appointment_id: e.id,
      scheduled_at: new Date(e.startTime).toISOString(),
      booked_at: new Date(e.dateAdded).toISOString(),
      status: e.deleted ? "deleted" : e.appointmentStatus.toLowerCase(),
      closer: e.assignedUserId || "",
      webinar_id: source?.webinar_id ?? bookingWebinar(e, person.tags || [], sessions, map, [...(registeredSessions.get(person.email?.trim().toLowerCase() || "") || [])]),
    };
  });
  // Save only after the complete provider snapshot has validated. Stable appointment IDs make reruns safe.
  if (rows.length) {
    for (let offset = 0; offset < rows.length; offset += 100) {
      const batch = rows.slice(offset, offset + 100);
      const existing = await db
        .from("appointments")
        .select("ghl_appointment_id,contact_id")
        .in(
          "ghl_appointment_id",
          batch.map((r) => r.ghl_appointment_id),
        );
      if (existing.error) throw new Error("Cannot verify booking identities");
      if (
        existing.data.some(
          (old) =>
            batch.find((r) => r.ghl_appointment_id === old.ghl_appointment_id)
              ?.contact_id !== old.contact_id,
        )
      )
        throw new Error(
          "Appointment contact identity changed; manual review required",
        );
    }
    const saved = await db
      .from("appointments")
      .upsert(rows, { onConflict: "ghl_appointment_id" });
    if (saved.error) throw new Error("Cannot save calendar bookings");
  }
  const now = new Date().toISOString();
  const notionCounts: Record<string,{bookings:number}> = {};
  for (const session of sessions) {
    if (!map[session.external_id] && ![...registeredSessions.values()].some(ids => ids.has(session.id))) continue;
    const booked = new Set(
      rows
        .filter((r) => r.webinar_id === session.id && isBooked(r.status))
        .map((r) => r.contact_id),
    );
    const applicants = new Set(
      stored
        .filter((c) => {
          const person = people.get(c.ghl_contact_id || "");
          return (
            person &&
            (booked.has(c.id) || person.tags?.includes(map[session.external_id]) || registeredSessions.get(person.email?.trim().toLowerCase() || "")?.has(session.id)) &&
            String(
              person.customFields?.find(
                (f) => f.id === fields.application_submitted,
              )?.value ?? "",
            )
              .trim()
              .toLowerCase() === "yes"
          );
        })
        .map((c) => c.id),
    );
    const result = await db
      .from("webinars")
      .update({
        ...(fields.application_submitted ? { application_count: applicants.size } : {}),
        call_booked_count: booked.size,
        applicant_booked_count: fields.application_submitted ? [...booked].filter((id) => applicants.has(id)).length : null,
        kpi_updated_at: now,
      })
      .eq("id", session.id);
    if (result.error) throw new Error("Cannot save webinar booking counts");
    notionCounts[session.external_id] = {bookings:booked.size};
  }
  await syncNotionCounts(notionCounts,sessions);
  const audit = await db.from("sync_runs").insert({
    source: "ghl_bookings",
    status: "succeeded",
    started_at: now,
    completed_at: now,
    records_processed: rows.length,
    records_failed: 0,
  });
  if (audit.error) throw new Error("Cannot save booking sync audit");
  return {
    imported: rows.length,
    from: new Date(start).toISOString(),
    through: new Date(end).toISOString(),
  };
}
