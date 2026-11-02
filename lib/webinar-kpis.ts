import { webinarAttendeeConversions } from "./webinar-attendee-conversions";
import type { Dataset, Webinar } from "./model";
export function webinarKpis(data: Dataset, w: Webinar) {
  const showApplicationRate = w.session_code !== "TCS002" && w.external_id !== "webinarjam:2:5:5";
  const registrants = new Set(
    data.registrations
      .filter((r) => r.webinar_id === w.id)
      .map((r) => r.contact_id),
  ).size;
  const conversions = webinarAttendeeConversions(data, w);
  const issues: string[] = [];
  if (w.peak_attendees != null && w.peak_attendees > registrants) issues.push("Peak audience exceeds imported registrants");
  if (w.pitch_attendees != null && w.peak_attendees != null && w.pitch_attendees > w.peak_attendees) issues.push("Pitch audience exceeds peak audience");
  if (showApplicationRate && conversions.applicants != null && w.pitch_attendees != null && conversions.applicants > w.pitch_attendees) issues.push("Attendee applicants exceed pitch audience");
  if (conversions.booked != null && w.pitch_attendees != null && conversions.booked > w.pitch_attendees) issues.push("Attendee bookings exceed pitch audience");
  const divide = (
    a: number | null | undefined,
    b: number | null | undefined,
  ) => (a == null || b == null || b === 0 ? null : a / b);
  return {
    registrants,
    conversions,
    issues,
    showApplicationRate,
    attendance: w.peak_attendees != null && w.peak_attendees > registrants ? null : divide(w.peak_attendees, registrants),
    retention: w.pitch_attendees != null && w.peak_attendees != null && w.pitch_attendees > w.peak_attendees ? null : divide(w.pitch_attendees, w.peak_attendees),
    application: !showApplicationRate || (conversions.applicants != null && w.pitch_attendees != null && conversions.applicants > w.pitch_attendees) ? null : divide(conversions.applicants, w.pitch_attendees),
    booking: conversions.booked != null && w.pitch_attendees != null && conversions.booked > w.pitch_attendees ? null : divide(conversions.booked, w.pitch_attendees),
    applicantBooking: divide(conversions.applicantsBooked, conversions.applicants),
  };
}
