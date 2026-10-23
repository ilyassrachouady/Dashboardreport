# Webinar booking attribution

## Activation

1. Run `supabase/006_booking_sources.sql` in the reporting Supabase project.
2. In each webinar's Booking attribution panel, enter its exact Trakyo short URLs for live,
   replay, email and WhatsApp follow-up booking links. Confirm each placement with the presenter.
   Do not assign a shared multi-session content item to several sessions: matches
   would be ambiguous and deliberately remain unclassified.
3. Run the GHL sync. It reads actual Trakyo `ghl_booking` journey events and matches
   GHL appointment ID, contact ID and location ID. It never substitutes clicks,
   contact last touch, appointment time or acquisition source for a booking event.
4. Review the three booking cards. They count unique people, excluding cancelled,
   deleted and invalid appointments. Conflicting live/after bookings for one person
   count as unclassified. Replay and follow-up combine under after-webinar.

Existing API key needs `links:read` and `leads:read`. No extra provider required.

## Current verified routing

The email link `https://go.thecreatorsociety.ca/apply` redirects to
`https://thecreatorsociety.ca/start`, which embeds Advisory Call calendar
`W8BVoDU02Ez8uAbOnGHR`. The Trakyo ID reaches the embedded calendar.

Trakyo content labels verified on 23 October 2026:

- `/start`: Webinar → Application form (presenter placement confirmed by user)
- `/apply`: Post Webinar Emails → Book call
- `/gptp`: Post-Event WhatsApp Messages
- `/cc82b109`: Replay → Application

Use `/apply` for email and `/gptp` for WhatsApp. Never infer a session
from a reusable generic content name.

Only one lead currently exposes booking events in Trakyo, so this integration
cannot reconstruct all historical bookings. Missing evidence stays unclassified.
The classification is stored against reporting appointments; it does not write a
new GHL contact field or change existing acquisition attribution.

No workflow messages were edited or sent, and no appointment was created to test.

## Future webinar checklist

- Create four distinct Trakyo content items and short links for the new session:
  live webinar, replay, email and WhatsApp. Reusing the same content item across
  sessions creates ambiguous event attribution even if the slugs differ.
- Save these links under the new session's Booking attribution panel.
- Use the corresponding link in the presenter CTA, replay page and GHL follow-up
  messages. A saved configuration alone does not replace the audience-facing links.
- Keep Advisory Call – Pre-Call Sequence published. Its first action sends
  AppointmentCreate to Trakyo. Read-only execution logs verified two successful
  HTTP 200 sends and matching provider events. Older version 11/12 enrollments
  predated the capture step; version 20 has verified sends; current is version 24.
- Run CRM sync after activation; ongoing refresh follows the configured GHL sync
  schedule, not the 15-second Whop refresh. Bookings outside the customer-booked
  trigger or without tracked-link evidence are not guaranteed attributable.
- Check Unclassified bookings after each webinar. A zero source count is not proof
  that the integration captured every booking.

The API rejects exact tracked-link reuse across sessions; the matcher also rejects
shared content IDs and conflicting event evidence. Do not reuse generic /start or
/apply content for later webinars while retaining TCS001's mapping.

## Webinar cohort bookings

The main count is cohort-based, independent of channel coverage. A booking belongs
when the GHL contact has the session-specific tag OR its normalized primary email
exactly matches an imported WebinarJam registration, and creation time is on/after
the webinar start. The latest eligible session wins; simultaneous eligible sessions
remain ambiguous. Exact tracked booking evidence can establish the session too.
Cancelled/invalid/deleted appointments are excluded, and contacts count once.
Registration matching is not attendance proof. The live test for TCS001 produced
25 people / 26 active appointments, including 21 linked registration contact IDs.

## Notion booking result write-back

After a successful booking reconciliation, the mapped Notion event's existing
Calls booked number is updated from the same unique cohort booking count used by
the dashboard. Writes are skipped when unchanged and read back for verification.
Peak, pitch, resources and formula properties are not written. Existing Notion
formulas recalculate from Calls booked. Separate live/after fields are not created.

## GHL attribution view

The report's CRM attribution table reads GHL Trakyo Source, Content and Campaign
for CRM-linked registered/booked contacts. Unknown values stay Unattributed.
These are current contact attribution snapshots, not appointment-specific channel
evidence. The two views intentionally answer different questions.
