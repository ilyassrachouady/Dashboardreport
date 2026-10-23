import { z } from "zod";
export const bookingSchema = z.object({
  id: z.string().min(1),
  locationId: z.string(),
  calendarId: z.string(),
  contactId: z.string().min(1),
  startTime: z.string(),
  dateAdded: z.string(),
  appointmentStatus: z.string().min(1),
  assignedUserId: z.string().nullish(),
  deleted: z.boolean().optional(),
});
export type GhlBooking = z.infer<typeof bookingSchema>;
export const isBooked = (status: string) =>
  !["cancelled", "canceled", "invalid", "deleted"].includes(
    status.toLowerCase(),
  );
export function bookingWebinar(
  booking: GhlBooking,
  tags: string[],
  sessions: Array<{ id: string; external_id: string; webinar_date: string }>,
  tagMap: Record<string, string>,
  emailMatchedSessions: string[] = [],
) {
  const bookedAt = Date.parse(booking.dateAdded);
  if (
    !Number.isFinite(bookedAt) ||
    !Number.isFinite(Date.parse(booking.startTime))
  )
    throw new Error("Invalid GHL appointment timestamps");
  // Cohort association, not proof of a live CTA click or attendance.
  const eligible = sessions.filter(w =>
    ((tagMap[w.external_id] && tags.includes(tagMap[w.external_id])) || emailMatchedSessions.includes(w.id)) &&
    Date.parse(w.webinar_date) <= bookedAt,
  ).sort((a,b) => b.webinar_date.localeCompare(a.webinar_date));
  if (eligible.length > 1 && Date.parse(eligible[0].webinar_date) === Date.parse(eligible[1].webinar_date)) return null;
  return eligible[0]?.id ?? null;
}
export async function fetchGhlBookings(start: number, end: number) {
  const calendarIds = (process.env.GHL_REPORTING_CALENDAR_IDS || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  if (!calendarIds.length)
    throw new Error("Configure GHL_REPORTING_CALENDAR_IDS");
  const headers = {
    Authorization: `Bearer ${process.env.GHL_API_KEY}`,
    Version: "v3",
  };
  const calendars = await fetch(
    `https://services.leadconnectorhq.com/calendars/?locationId=${encodeURIComponent(process.env.GHL_LOCATION_ID!)}`,
    { headers, signal: AbortSignal.timeout(20000) },
  );
  if (!calendars.ok)
    throw new Error(`GHL calendars unavailable (${calendars.status})`);
  const list = await calendars.json();
  if (
    !calendarIds.every((id) =>
      list.calendars?.some((c: { id: string }) => c.id === id),
    )
  )
    throw new Error("Reporting calendar not found in configured location");
  const unique = new Map<string, GhlBooking>();
  for (const calendarId of calendarIds)
    for (let from = start; from < end; from += 28 * 86400000) {
      const url = new URL(
        "https://services.leadconnectorhq.com/calendars/events",
      );
      for (const [key, value] of Object.entries({
        locationId: process.env.GHL_LOCATION_ID!,
        calendarId,
        startTime: String(from),
        endTime: String(Math.min(end, from + 28 * 86400000)),
      }))
        url.searchParams.set(key, value);
      const r = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(20000),
      });
      if (!r.ok) throw new Error(`GHL bookings unavailable (${r.status})`);
      const body = await r.json();
      const events = z.array(bookingSchema).parse(body.events);
      if (events.length >= 1000)
        throw new Error(
          "Calendar batch may be truncated; shorten import window",
        );
      for (const event of events) {
        if (
          event.locationId !== process.env.GHL_LOCATION_ID ||
          event.calendarId !== calendarId
        )
          throw new Error("Calendar location mismatch");
        unique.set(event.id, event);
      }
    }
  return [...unique.values()];
}
