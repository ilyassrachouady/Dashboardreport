# Webinar operations setup

## Ready locally

- Webinar reports → Session setup: per-occurrence status, organic/paid/mixed promotion, presenter URL, slides, replay, Notion event URL, and three separate booking links.
- Uses existing webinar IDs and existing peak/pitch form. Operations saves never overwrite KPI counts.
- Webinar reports → Webinar attendance: preview CSV matches, then explicitly import verified attendance for the selected session. Displays live and replay flags independently. Unknown is not absent.
- Exact email matching to existing imported CRM contacts only. Unmatched emails block the entire import; no guessed matches, new contacts or partial saves.
- Atomic upserts prevent duplicate contact/session records and preserve existing evidence when an imported flag is unknown. Re-imports can explicitly correct true/false values.
- Import does not alter sales-call Attendance, registration totals, peak/pitch counts, or GHL tags.

## Database step

Run `supabase/003_webinar_operations.sql` in the existing reporting Supabase project's SQL editor. It uses only the `revenue_intelligence` schema, is rerunnable, preserves rows, enables RLS on attendance and grants API access only to the service role. No live migration has been applied by this implementation.

## Attendance CSV format

Use `email,attended_live,attended_replay`, with true/false/blank values. Empty means unknown. A native WebinarJam export must first be checked and mapped to these columns; a registrant export is not attendance evidence. Do not mark absent merely because a person is absent from an attendee-only export.

## Notion connection

Provided database link: https://app.notion.com/p/lewisdkkirby/40104bbfdb008061ad37ef7c11731897?v=40104bbfdb00809cbc89000c741f3b89

Notion access to the user's account does not yet establish access for the agent or a deployed background integration. Connect Notion to inspect the database's actual properties and relations first. Do not guess page IDs or add duplicate event records. A deployed sync also needs a server-side Notion integration authorized for this database; the chat connection alone is not a production background credential.

## Remaining connections

- Inspect one real attendee export/provider response before automating attendance ingestion.
- Verify Notion property mapping and event identity; choose which system owns each editable field. Use the existing dashboard counts for calculated results.
- Verify per-session Trakyo booking links and retained session IDs. Saving a URL is not proof a booking came from that link.
- Persist link-source evidence with actual booking creation time. Keep timing separate from live/replay attendance. `bookingTiming` is a tested classification helper only; it is not yet wired to automatic booking attribution.
- GHL per-session attendance tags are not enabled. Establish verified attendance and exact session/tag mapping before writing them. Never overwrite the sales-call Attendance field with webinar attendance.


## Notion-led moderator workflow (test workspace)

- `.env.local` contains the test API credentials; never commit them.
- `NOTION_SESSION_MAP_JSON` explicitly links `webinarjam:2:2:2` to the existing duplicated Notion event. Future sessions need their own explicit mapping; no title-only guessing and no duplicate event creation.
- Notion owns peak/pitch counts, presenter/slides/replay links, promotion audience and status. The dashboard reads them without caching on initial load and each visible-tab poll (approximately 15 seconds plus request time).
- Blank Notion counts remain unknown. Inconsistent peak/pitch counts or API failures display an error and unavailable manual metrics rather than silently using old database entries.
- Dashboard editor/API cannot overwrite these Notion-owned fields on mapped sessions.
- Registrants remain owned by imported WebinarJam registration records. After successful WebinarJam imports, only Notion Registrants is updated if changed. The test page was reconciled to 274; peak 72 and pitch 62 were preserved.
- GHL remains the owner of its existing applicant/booking counts. Notion formula outputs are not imported as independent numbers; the dashboard calculates its rates from the source counts.
- Original Lewis database is untouched. Vercel needs the same server-only Notion environment variables when this is deployed. Chat MCP is not used.

## Future webinars

1. Run `supabase/004_webinar_connections.sql` once to enable persisted per-session Notion connections and GHL cohort tags.
2. Publish/schedule the webinar in WebinarJam. Scheduled webinars under any webinar ID on the connected account are discovered; the Right Now example is excluded. Existing auto-sync runs discovery when the dashboard is opened after sources become stale. Use **Webinar reports → Refresh webinars** to discover immediately.
3. Sessions with no registrations still appear. When a provider event ID becomes known, the same session UUID and Notion connection are retained. Changed dates on reused event IDs and ambiguous multi-occurrence schedules stop for review instead of overwriting history.
4. Create the corresponding event in Notion. Select the webinar in the dashboard, open **Connect this webinar → Load Notion events**, choose its exact event by name/date, and save. This stores the association in Supabase, not an environment variable. It does not create duplicate Notion events.
5. Optionally supply that session's exact GHL cohort tag. Each session needs its own tag; the system prevents one tag or Notion event being reused for different session records. Run **Sync CRM data** to refresh cohort counts after setup. This is configuration only: it does not create GHL tags or build tagging automations.
6. Moderators edit peak/pitch and resources in Notion. The selected report reads the correct event. Imported registrations update only its automatic Registrants field after successful WebinarJam sync.

API discovery on 22 October currently exposes only the completed Sofia scheduled webinar plus a Right Now example. No next scheduled webinar is published/visible through this API yet. A Notion event alone does not create a WebinarJam session.

Booking placement attribution (live-room vs replay vs email) still requires verified tracked-link evidence. Session cohort attribution currently follows the existing GHL tag plus booking-creation-time rules; it does not establish which placement a person clicked.
