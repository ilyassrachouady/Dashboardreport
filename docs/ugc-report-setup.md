# UGC Queen reporting

The `/ugc` workspace reads UGC's GHL and WebinarJam accounts directly. It does not
load Creator Society's reporting dataset, run its sync jobs, or read its Whop
account. The workspace selector navigates between `/` and `/ugc` with a full page
load, so the previous client's component state is discarded.

## Server configuration

Configure `UGC_GHL_API_KEY`, `UGC_GHL_LOCATION_ID`, `UGC_WEBINARJAM_API_KEY`,
`UGC_WEBINARJAM_WEBINAR_ID`, `UGC_NOTION_PAGE_ID`, and `UGC_NOTION_CLIENT_ID`.
Keep the existing `NOTION_API_KEY` and `NOTION_DATABASE_ID`: both clients use
Client Events. Keys stay server-only; UGC never falls back to TCS credentials.
These variables are prepared in the ignored local environment file. They must
also be configured on Vercel when this feature is deployed.

`UGC_NOTION_PAGE_ID` anchors the client. Its exact Client relation must match
`UGC_NOTION_CLIENT_ID`. The loader reads only rows with that relation and matches
each row to one unique WebinarJam schedule by its full start timestamp. Missing
or ambiguous matches stop the import rather than mixing sessions.

New event rows for the same Client relation and configured WebinarJam webinar
are picked up automatically. A different WebinarJam webinar requires updating
`UGC_WEBINARJAM_WEBINAR_ID` (or extending configuration to multiple webinars).
The stable session identity includes the UGC namespace, webinar, schedule and
event IDs. QUE display numbers follow event date order; adding an older event
can change those display numbers. They are not persisted TCS session codes.

## Data and refresh

- Registrants: unique normalized emails in the exact WebinarJam occurrence.
- Attendance: provider flags after the event starts; missing flags stay unknown.
- Peak/pitch/timing: Notion moderator fields and End Time formula.
- Attendance rate: peak / unique registrants.
- Retention: pitch / peak.
- Source: unambiguous WebinarJam UTM source; otherwise the exact email match's
  current GHL UTM source. These are source labels, not purchase attribution.
- Duplicate CRM email matches stay unmatched. No contacts are merged.
- Applications, bookings and financial metrics are unavailable until their UGC
  sources are configured; TCS or Whop data never substitutes for them.

The page loads fresh data on opening. While visible, it refreshes every minute.
Refresh data and automatic refresh also sync unique registration totals back to
the exact linked UGC Notion rows. Only Registrants is written; moderator inputs,
formulas and other clients' rows are preserved. GET reads do not write Notion.
A failed refresh keeps the previous report with a visible error and timestamp.
The internal dashboard's existing authentication protects the page and API.

## Verification

Live check on 6 November 2026: QUE001, 10 November at 19:00 Europe/Berlin.
32 WebinarJam records represented 31 unique people; 17 matched UGC GHL contacts
and 14 did not. The source breakdown was 9 Instagram, 6 Skool, 2 Email and
14 unattributed. These are verification results, not application constants.

The UGC registration count was written back and verified by the existing Notion
sync. Browser QA verified the report, client selector, live refresh and layout.
Tests cover tenant rejection, duplicate identities, schedule matching,
reschedules, unknown attendance, impossible moderator counts, dedicated provider
credentials and exact Notion write scope.
