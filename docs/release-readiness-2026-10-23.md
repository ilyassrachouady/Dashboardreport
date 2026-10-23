# Release readiness — 23 October 2026

## Verified

- Show-up uses current GHL Attended / (Attended + No Show), one contact once.
- Overview operational cards use the same CRM aggregates as Sales.
- Webinar applicants/bookings use one tag/email cohort; the tag-only precheck no
  longer publishes an intermediate denominator.
- Bookings are unique people, not appointment rows. Cancellations are excluded.
- Appointment-specific channel evidence stays separate from CRM contact attribution.
- Notion booking count writes are read back; moderator inputs/formulas stay untouched.
- TCS001 and TCS002 have persisted Notion and canonical GHL tag mappings.
- Mixed legacy event IDs no longer move old registrations to the upcoming session.
- Provider attendance positives survive missing fields/provider resets.
- Attendance tags propagate only from verified live-attendance evidence.
- Both email and WhatsApp link configurations must resolve independently.
- Live refresh includes appointment rows and webinar totals together.
- Failed syncs no longer suppress refresh as though they had succeeded.
- Runtime GET /api/payments/live returned 200 with GHL, Whop payments/balance,
  Trakyo transactions and webinar data. The standalone Node cache-context warning
  was a test-harness artifact; it did not occur in the real Next.js API request.
- Missing Basic Auth returned 401; cross-origin writes returned 403.
- Desktop/mobile demo browser checks: no page errors or horizontal overflow.
- .env.local remains ignored; no environment files belong in the release.

## Source-data limitations / unfinished launch checks

- Chloe Chan and Dabi Kim have blank GHL Payment Structure selections. Do not
  infer Financing/PIF/manual from amounts or historic screenshots.
- Six provider-confirmed live attendees lack linked GHL contact IDs.
- TCS001 registrants confirmed as 274 by the user; obsolete CSV comparison removed.
- Historical booking-channel evidence is incomplete. Cohort bookings remain usable;
  channel unknown is not a zero-booking assertion.
- TCS002 dedicated links are created and mapped but have not been confirmed placed
  into audience-facing webinar CTA, replay page or follow-up messages.
- A controlled booking through those links is still required for full end-to-end
  sign-off. No real booking or outbound test message was sent in these checks.
- Deployment and a post-deploy production smoke test remain outstanding.

This is code readiness with known source gaps, not an assertion that all historical
source data is complete or that the full customer booking path has been tested.
