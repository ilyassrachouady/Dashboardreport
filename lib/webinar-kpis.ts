import type { Dataset, Webinar } from "./model";
export function webinarKpis(data: Dataset, w: Webinar) {
  const registrants = new Set(
    data.registrations
      .filter((r) => r.webinar_id === w.id)
      .map((r) => r.contact_id),
  ).size;
  const divide = (
    a: number | null | undefined,
    b: number | null | undefined,
  ) => (a == null || b == null || b === 0 ? null : a / b);
  return {
    registrants,
    attendance: divide(w.peak_attendees, registrants),
    retention: divide(w.pitch_attendees, w.peak_attendees),
    application: divide(w.application_count, w.pitch_attendees),
    booking: divide(w.call_booked_count, w.pitch_attendees),
    applicantBooking: divide(w.applicant_booked_count, w.application_count),
  };
}
