# TCS002 preflight — 23 October 2026

Session: 28 October 2026, 19:00 America/New_York / 23:00 UTC.
Stable reporting UUID: 322677f8-a11d-451d-8481-7b06acac271e.
Provider identity promoted from placeholder to webinarjam:2:5:5, retaining UUID,
TCS002 code, cohort mapping and Notion event connection.

## Verified live

- WebinarJam sync succeeded: 278 registrations processed, zero failures.
- Four TCS002 registrations; four exact existing GHL email matches; all four carry
  28oct2026-registered. No synthetic contacts were created.
- Existing registration workflow is published at version 67 and allows repeat entry.
- Notion row matched by exact event timestamp, with the same Client Events data source.
- New distinct Trakyo content items/links were created and read back. Tracking
  parameters enabled; destination is the existing advisory booking page.
- Successful webinar/GHL sync now propagates confirmed live-attendance tags only,
  skipping existing tags. Future attendance is not inferred from registration flags.
- 59 unit tests and production build passed.

## TCS002 booking links

- Live CTA: https://go.thecreatorsociety.ca/tcs002-live
- Replay page booking CTA: https://go.thecreatorsociety.ca/tcs002-replay
- Follow-up emails: https://go.thecreatorsociety.ca/tcs002-email
- WhatsApp follow-up: https://go.thecreatorsociety.ca/tcs002-whatsapp

Creating/mapping these links does not replace audience-facing CTA/message links.
No published email workflow or replay page was edited in this preflight.

## Regression repaired

Some October 14 rows expose the October 28 event id/date alongside their original
October 14 schedule. A canonical event id is accepted only if its explicit event
date agrees with the schedule date. All rows on that schedule use its verified
canonical identity. Ambiguous event sets still fail closed. This preserves TCS001
and allows TCS002 to import without moving historical registrations.

## Still needed for full end-to-end sign-off

1. Place each new link in the appropriate CTA/message.
2. Complete one controlled booking with an approved test inbox, verifying the
   GHL appointment id, Trakyo event, dashboard classification and Notion result.
   This may trigger the existing confirmation/reminder/Slack workflow.
3. After the webinar, verify real attendance propagation. Future attendance cannot
   be proven before the event; aggregate peak/pitch remain moderator-owned.

No real call was booked and no email/SMS/Slack test message was sent here.
Code remains local until the release is authorized after the remaining checks.
