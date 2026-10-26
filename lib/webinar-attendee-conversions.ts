import type { Dataset, Webinar } from "./model";

// Registration tags and current attribution never establish live attendance.
// Both conversion numerators are subsets of this exact session's live audience.
export function webinarAttendeeConversions(data: Dataset, w: Webinar, now = Date.now()) {
  const evidence = data.webinarAttendance?.filter(row => row.webinar_id === w.id);
  const ready = Date.parse(w.webinar_date) <= now && evidence !== undefined && evidence.length > 0;
  const attendees = new Set(evidence?.filter(row => row.attended_live === true).map(row => row.contact_id));
  const identities = new Map(data.contacts.map(c => [c.id, c.ghl_contact_id]));
  const applicationsReady = data.crmApplications !== undefined && !data.crmApplicationsError && !data.crmStructuresError;
  const appliedGhl = new Set(data.crmApplications?.filter(c => c.applied).map(c => c.ghl_contact_id));
  const applicants = new Set([...attendees].filter(id => appliedGhl.has(identities.get(id) || "")));
  const validBookings = data.appointments.filter(a => a.webinar_id === w.id &&
    !["cancelled", "canceled", "invalid", "deleted"].includes(a.status.toLowerCase()) &&
    Date.parse(a.booked_at) >= Date.parse(w.webinar_date));
  const booked = new Set(validBookings.filter(a => attendees.has(a.contact_id)).map(a => a.contact_id));
  const followup = new Set(validBookings.filter(a => a.booking_source === "replay" || a.booking_source === "followup").map(a => a.contact_id));
  const withoutAttendance = new Set(validBookings.filter(a => !attendees.has(a.contact_id)).map(a => a.contact_id));
  const end = w.webinar_ended_at ? Date.parse(w.webinar_ended_at) : NaN;
  const timingReady = ready && Number.isFinite(end) && end >= Date.parse(w.webinar_date) && end <= now;
  const firstBooking = new Map<string, number>();
  for (const a of validBookings) firstBooking.set(a.contact_id, Math.min(firstBooking.get(a.contact_id) ?? Infinity, Date.parse(a.booked_at)));
  const after = [...firstBooking].filter(([,time]) => time > end).map(([id]) => id);
  return {
    liveAttendees: ready ? attendees.size : null,
    applicants: ready && applicationsReady ? applicants.size : null,
    booked: ready ? booked.size : null,
    applicantsBooked: ready && applicationsReady ? [...booked].filter(id => applicants.has(id)).length : null,
    afterBookings: timingReady ? after.length : null,
    afterAttendees: timingReady ? after.filter(id => attendees.has(id)).length : null,
    afterWithoutLiveAttendance: timingReady ? after.filter(id => !attendees.has(id)).length : null,
    followupBookings: ready ? followup.size : null,
    followupAttendees: ready ? [...followup].filter(id => attendees.has(id)).length : null,
    bookingsWithoutLiveAttendance: ready ? withoutAttendance.size : null,
    unlinkedAttendees: ready ? [...attendees].filter(id => !identities.get(id)).length : null,
  };
}
