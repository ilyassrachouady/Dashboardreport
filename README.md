# Creator Society Revenue Intelligence

A separate Next.js application. Payment Desk remains in the parent folder. No source credentials or live customer data are copied into this project.

## Local preview

Node 22+. `npm install`, then copy `.env.example` to `.env.local`. Set `DEMO_MODE=true` explicitly to explore the labeled sample dataset. `npm run dev` uses port 3001. For real data set `DEMO_MODE=false` and configure Supabase.

## Architecture

Provider payload → server adapter → validated event → atomic Postgres ingestion → normalized records → shared reporting functions → six dashboard views. Page loads read Supabase only. In demo mode they use a dedicated synthetic fixture, never a silent live-data fallback.

The identity resolver prefers stable GHL IDs; normalized email, E.164 phone and Trakyo ID are fallback candidates. Multiple candidate people or conflicting canonical IDs cause rejection, never a name-based merge. Advisory locks serialize overlapping identity events. Each provider/event ID is idempotent; changed replays are rejected. Related contacts, touches, registrations, calls, sales and payments ingest in one transaction. Failed batches remain in sync history.

## Database setup

Apply `supabase/001_reporting.sql` to a dedicated Supabase project or to the isolated `revenue_intelligence` schema in a shared project. Expose that schema in Supabase API settings. Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SCHEMA`. RLS is enabled with no browser policies; all reads and writes are server-only using the service role. The migration is a first-run migration, not a repeatedly executable reset.

## Access

Production refuses access until `REPORTING_PASSWORD` is configured. HTTP Basic user is `team`. Configure a long random password over HTTPS. This is an internal V1 access gate; migrate to per-user Supabase Auth before inviting a broader team or requiring user audit trails. No password is embedded in client JavaScript. Ingestion is separately authenticated with a 32+ character `INGEST_SECRET`, never the dashboard password.

## Ingestion

POST `/api/ingest` with `Authorization: Bearer <INGEST_SECRET>` and the event contract in `lib/integrations/schema.ts`. Provider names: `ghl`, `trakyo`, `webinars`, `whop`. All monetary amounts are integer USD cents. Native provider webhooks are NOT accepted directly: an authenticated n8n job or adapter must validate the provider signature and transform it first. Do not put a Whop secret or a Supabase service key in a browser client.

Minimal event:

```json
{
  "provider": "ghl",
  "event_id": "contact:abc:revision-1",
  "contact": {
    "ghl_contact_id": "abc",
    "email": "person@example.com",
    "first_name": "Sam"
  },
  "touches": [
    {
      "external_touch_id": "touch-1",
      "touch_type": "first_touch",
      "source": "ig",
      "medium": "paid",
      "campaign": "october",
      "content": "student-story",
      "occurred_at": "2026-10-14T10:00:00Z"
    }
  ]
}
```

Optional arrays: `webinars`, `registrations`, `appointments`, `calls`, `sales`, `payments`. References use external IDs and are resolved transactionally. A webinar external ID must identify an **occurrence**, not an entire recurring webinar series. Process shared webinar metadata before registrations. Send appointments before linked calls, sales before linked payments (same event also works). For cross-provider references an explicit mapping/adapter must use the same canonical provider; never guess associations.

GHL Sync now imports contact identity and acquisition touches. Requires a location-scoped PIT and `GHL_LOCATION_ID`. It does **not** fabricate historical calls from the latest contact custom fields. Historical calls and payments must come from Payment Desk's event ledger/Whop verified events. Trakyo Sync now imports paginated leads and first/last touches using `TRAKYO_API_KEY` with `leads:read`. WebinarJam Sync now imports registrations for `WEBINARJAM_WEBINAR_ID` using `WEBINARJAM_API_KEY`; member ID and hash are retained as configuration but not needed by these read endpoints. Wall-clock dates use the webinar timezone. The selected webinar must have a schedule date that identifies the occurrence; recurring series require additional occurrence mapping before use. API attendance details are not yet stored by this adapter. Whop Sync now imports live calls, sales and successful sale-linked receipts from the existing Payment Desk ledger (`PAYMENT_DESK_SCHEMA`). Automatic WebinarJam graph access remains unavailable through the verified public API; nullable attendance stays unavailable until a supported source supplies it.

## Verified source normalization

CRM audit for location `WgeDf11I8yBah6LRzZL1` (2026-10-19): 3,655 contacts; 84 have populated UTM source/medium, 45 UTM campaign, 83 UTM content, 232 Trakyo lead ID, and 218 Trakyo source/content. These are field coverage counts, not attributed webinar registrant counts. The GHL importer currently reads UTM custom fields; direct Trakyo ingestion supplies its own first/last touches. GHL Trakyo snapshot fields are not yet a fallback importer.

Reporting aliases persist in `source_mappings`: `ig`/`instagram` → Instagram, `skool` → Skool, `youtube` → YouTube, `discord` → Discord, `referrer` → Referral, and `Direct traffic` → Direct. Known case/whitespace variants are mapped on future syncs; explicit user mappings take precedence. Raw CRM/touch/registration values remain unchanged. Custom YouTube stays separate; unknown sources and blank fields are never guessed. Campaign and content identifiers are not case-folded.

## Report workspace

The app opens on Webinar reports. Choose one session, inspect five rate cards and the audience funnel, drill into registrants by normalized first-touch source, or compare sessions. Export report downloads the session inputs and the five computed rates. One count editor serves all rate cards and the input checklist. Revenue overview remains a separate navigation item. Webinar reports intentionally use full-session data rather than unrelated acquisition-cohort filters. Live data follows server refreshes; demo-only mapping edits remain local.

## Webinar KPI setup

Run `supabase/002_webinar_kpis.sql` once in the same Supabase project (rerunnable). Under Webinars, each session has Attendance = peak / unique registrants, Retention = pitch / peak, Application = applicants / pitch, Call booked = booked / pitch, and Applicant-to-booking = booked applicants / applicants. The last numerator includes only Application = Yes; it is distinct from all booked calls. Registrant counts come from WebinarJam. The session count editor persists the remaining verified totals; unknown values stay NULL and rates with missing/zero denominators show Unavailable. These are full-session metrics, not the global acquisition cohort filter. GHL has Application Submitted and Appointment Booked Date fields, but automatic session-specific application/booking attribution is not connected yet. Manual counts are not overwritten by registration syncs.

## Reporting definitions

- Date filters select an **acquisition cohort** (registrations, or contact creation for unregistered leads). Downstream cash includes later installment payments for those selected people.
- Webinar filters require explicit webinar → appointment links for downstream conversion. Unlinked calls are excluded rather than attributed to every webinar the contact attended.
- Show rate = attended calls / non-cancelled booked appointments.
- Close rate = sale records / attended calls. A sale is distinct from a checkout and a deposit is not a closed sale.
- Contract revenue = sum of full sales contract values. Cash = successful, sale-linked USD payments. Pending, failed, refunded and unlinked payments are excluded.
- Revenue per registrant = contract revenue / registration events.
- Cash per call = collected cash / attended calls.
- First/last touch sorts by provider event timestamp, retains every immutable touch. Exact case-sensitive mappings apply at query time; raw values never change.
- Ratios with a zero denominator show an em dash, not an invented percentage.

This V1 loads paginated normalized records server-side. Move aggregations into SQL views/RPC and add indexed query pagination before operating at large scale. `sync_runs` describes processing outcomes; add a durable scheduler/queue and per-provider rate-limit backoff for production-volume imports.

## Deployment

Create a **new** Vercel project with Root Directory `revenue-intelligence`, Node 22, framework Next.js. Import server env variables. Do not attach it to the Payment Desk Vercel project. The local app uses the reporting schema configured in Supabase. Deploying the app is a separate step.

## Checks

`npm run typecheck`, `npm test`, `npm run build`. Verify the real adapters against a controlled test contact before enabling unattended sync. Demo counts are illustrative and cannot establish integration readiness.

## GHL webinar tag cohorts

`GHL_WEBINAR_TAG_MAP_JSON` maps verified occurrence external IDs to exact CRM tags. The local October 14 report maps `webinarjam:2:2:2` to `14-october-2026-webinar`. GHL Sync and the report's Sync applicants action count distinct GHL contact IDs with this tag and current Application Submitted = Yes (case/whitespace insensitive). This is a current cohort snapshot, not proof that application submission happened during the session. Completed cohort runs are recorded as `ghl_webinar:<webinar UUID>` in sync_runs and labeled in Report inputs. CRM-managed applicants cannot be overwritten by the manual count endpoint.

The existing PIT is not authorized for calendar-list/event reads (401), and the tagged cohort's Appointment Booked Date field is empty. Booking counts therefore remain manual and are never zeroed based on this empty field. Enable the appropriate calendar and calendar-event read scopes before adding automatic booking attribution. No CRM contacts or tags are modified by this integration.

## Registrant reconciliation check — 2026-10-20

Live WebinarJam API webinar 2, schedule 2/event 2 returns 274 records across 11 pages: 274 unique registration IDs and 274 unique normalized emails. Explicit all-time/all-attendance/all-purchase filters still return 274. The provided analytics summary CSV reports 291. The importer matches the API, and no extra people are fabricated from the aggregate CSV. `verifyRegistrantPages` rejects missing/repeated pages, changing totals, incomplete counts and duplicate registration IDs. The report shows the unresolved 17-person difference against the uploaded historical export. Direct browser verification of webinar 2 with all sessions/all events confirms its Active registrants page also shows 274, while Analytics shows 291. This is a provider-surface discrepancy, not an import drop; provider clarification is needed before changing the reporting denominator.

GHL calendar-list and event requests still return 401 missing scope. Required PIT scopes are `calendars.readonly` and `calendars/events.readonly`. Booking totals remain manual until access is available and the calendar/window mapping can be verified.

### Calendar booking sync
GHL sync and **Sync CRM data** now import the selected `GHL_REPORTING_CALENDAR_IDS` calendars into reporting appointments and refresh webinar booking counts. Only the Advisory Call calendar is configured locally. Requires `calendars.readonly` and `calendars/events.readonly`. No appointments are created or changed in GHL.

Import coverage: scheduled appointments from the earlier of 90 days ago or the earliest imported webinar (minus one day), through 90 days ahead, fetched in 28-day windows. Appointment IDs are upserted, so retries do not duplicate bookings; statuses refresh on subsequent syncs. Out-of-window appointments are not refreshed. Deleted events returned by GHL are excluded; events silently omitted by the provider are not assumed deleted.

Webinar attribution: contact must carry the exact configured cohort tag; booking creation must be on/after the session start. If multiple tags match, use the latest session already started. This is a documented cohort attribution rule, not proof of which webinar caused the booking. Counts are unique contacts, excluding cancelled, invalid and deleted appointments. Applicant-booked counts additionally require the current Application Submitted = Yes field. Imported appointment totals in Overview count appointments, not unique webinar contacts.

CRM-managed booking fields are read-only after a successful calendar sync; peak and pitch counts remain editable. Sync remains on demand, not scheduled.

### Live Whop history and chart corrections — 2026-10-20
The dashboard now reads native `/api/v1/payments?account_id=…` history server-side, with cursor pagination and account validation. The live API uses account_id and money objects; the older company_id/numeric-total examples are incompatible with this account's current version. Existing WHOP_API_KEY/WHOP_COMPANY_ID work; WHOP_SANDBOX controls the host. No new API key or SQL migration was needed.

History is fetched live on dashboard load/refresh; it is not a persisted historical snapshot. Whop sync also validates native access before importing Payment Desk agreements. Whop errors are displayed explicitly; they do not silently turn into confirmed zero cash.

Company-wide unfiltered USD cash includes successful Whop receipts less refunds, before fees, deduplicated against Payment Desk receipts by provider payment ID. CAD stays separate in Sales → Whop payment history. Unknown CRM identities remain unmatched and do not create contacts or source/closer attribution. Filtered cohorts require verified contact identity; offer/closer filters require a linked agreement. Cash per attended call excludes unmatched company receipts. Historical receipts are not converted into inferred contract values or extra closed-sale agreements.

The replacement performance chart separates cash, recorded agreements, and registration counts; supports bars/area and daily/weekly/monthly grouping; fills zero-activity days; uses UTC and actual currency labels. History table has its own company-wide currency/status filters independent of acquisition-cohort filters.

### Reporting scope simplified — 2026-10-20
Overview now keeps four independent totals: USD receipts (explicitly including test payments), unmatched USD receipts, imported registration records, and active calendar appointments. Removed the cross-system funnel and show/close/revenue-per-registrant/cash-per-call ratios from visible overview and attribution reporting. Source tables show only registration/appointment counts and verified matched receipts. Payment Desk agreements remain available with an incomplete-reporting/test-activity notice. No source data or test records were deleted. The five client-requested webinar KPIs remain in session reports with their existing provenance and reconciliation warning.

### Client workspace layout — 2026-10-20
Replaced the overview's section-anchor navigation with one executive summary: eight scoped metrics, revenue chart, registration source summary, and recent Whop payments. Detailed source analysis remains in Acquisition, session KPIs in Webinar reports, full payments and agreements in Sales & payments, and coverage/definitions in Integrations. No data or metrics were deleted. Overview is the landing view. Removed numbered section labels and duplicate Sales anchor navigation, clarified page descriptions and action labels, and retained existing filters/drill-throughs.
