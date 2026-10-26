import { webinarAttendeeConversions } from "./webinar-attendee-conversions";
import type { Dataset, Webinar } from "./model";
export function webinarKpis(data: Dataset, w: Webinar) {
  const registrants = new Set(
    data.registrations
      .filter((r) => r.webinar_id === w.id)
      .map((r) => r.contact_id),
  ).size;
  const conversions = webinarAttendeeConversions(data, w);
  const issues: string[] = [];
  if (w.peak_attendees != null && w.peak_attendees > registrants) issues.push("Peak audience exceeds imported registrants");
  if (w.pitch_attendees != null && w.peak_attendees != null && w.pitch_attendees > w.peak_attendees) issues.push("Pitch audience exceeds peak audience");
  const divide = (
    a: number | null | undefined,
    b: number | null | undefined,
  ) => (a == null || b == null || b === 0 ? null : a / b);
  return {
    registrants,
    conversions,
    issues,
    attendance: w.peak_attendees != null && w.peak_attendees > registrants ? null : divide(w.peak_attendees, registrants),
    retention: w.pitch_attendees != null && w.peak_attendees != null && w.pitch_attendees > w.peak_attendees ? null : divide(w.pitch_attendees, w.peak_attendees),
    application: divide(conversions.applicants, conversions.liveAttendees),
    booking: divide(conversions.booked, conversions.liveAttendees),
    applicantBooking: divide(conversions.applicantsBooked, conversions.applicants),
  };
}
