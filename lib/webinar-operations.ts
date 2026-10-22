import { z } from "zod";
const optionalUrl = z.string().trim().max(2048).refine((value) => {
  if (!value) return true;
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}, "Use a full HTTPS link, or leave blank.").transform(value => value || null);
export const webinarOperationsSchema = z.object({
  id: z.uuid(),
  event_status: z.enum(["unknown", "planned", "ready", "completed", "cancelled"]),
  promotion_type: z.enum(["unknown", "organic", "paid", "mixed"]),
  presenter_url: optionalUrl,
  slides_url: optionalUrl,
  replay_url: optionalUrl,
  notion_page_url: optionalUrl,
  live_booking_url: optionalUrl,
  replay_booking_url: optionalUrl,
  followup_booking_url: optionalUrl,
}).strict();

// Booking source and webinar attendance are independent evidence, never inferred
// from a registration, an appointment's scheduled time, or a person's latest tag.
export function bookingTiming(bookedAt: string, startsAt: string, endsAt: string | null) {
  const booked = Date.parse(bookedAt), start = Date.parse(startsAt), end = endsAt ? Date.parse(endsAt) : NaN;
  if (![booked,start,end].every(Number.isFinite) || end < start) return "unknown";
  return booked < start ? "before" : booked <= end ? "during" : "after";
}
