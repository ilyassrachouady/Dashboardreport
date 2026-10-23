import type { Dataset, Webinar } from "./model";
export function webinarKpis(data: Dataset, w: Webinar) {
  const registrants = new Set(
    data.registrations
      .filter((r) => r.webinar_id === w.id)
      .map((r) => r.contact_id),
  ).size;
  const issues: string[] = [];
  if (w.peak_attendees != null && w.peak_attendees > registrants) issues.push("Peak audience exceeds imported registrants");
  if (w.pitch_attendees != null && w.peak_attendees != null && w.pitch_attendees > w.peak_attendees) issues.push("Pitch audience exceeds peak audience");
  if (w.applicant_booked_count != null && w.application_count != null && w.applicant_booked_count > w.application_count) issues.push("Booked applicants exceed total applicants");
  if (w.applicant_booked_count != null && w.call_booked_count != null && w.applicant_booked_count > w.call_booked_count) issues.push("Booked applicants exceed booked contacts");
  const divide = (
    a: number | null | undefined,
    b: number | null | undefined,
  ) => (a == null || b == null || b === 0 ? null : a / b);
  return {
    registrants,
    issues,
    attendance: w.peak_attendees != null && w.peak_attendees > registrants ? null : divide(w.peak_attendees, registrants),
    retention: w.pitch_attendees != null && w.peak_attendees != null && w.pitch_attendees > w.peak_attendees ? null : divide(w.pitch_attendees, w.peak_attendees),
    application: divide(w.application_count, w.pitch_attendees),
    booking: divide(w.call_booked_count, w.pitch_attendees),
    applicantBooking: issues.some(i => i.startsWith("Booked applicants")) ? null : divide(w.applicant_booked_count, w.application_count),
  };
}
