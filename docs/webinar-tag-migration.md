# Webinar tag migration — 23 October 2026

Verified against live GHL location WgeDf11I8yBah6LRzZL1.

| Session | Canonical registration tag | Verified contacts |
|---|---|---:|
| TCS001 | 14oct2026-registered | 269 |
| TCS002 | 28oct2026-registered | 3 |

The existing 269-contact October 14 cohort received the new tag additively.
All 269 retained `14-october-2026-webinar`; independent read-back found no
legacy cohort contact missing the new tag. API reported zero tag-update errors.
Dashboard `ghl_cohort_tag` mappings are persisted for both sessions.

All four canonical tags exist, including `14oct2026-attended` and
`28oct2026-attended`. No attendance tags were assigned: the reporting attendance
table and legacy generic attended tag contained no individual evidence to migrate.
Creating an attended tag does not itself populate attendance or wire a provider
attendance callback. That remains part of attendance reconciliation / end-to-end QA.

The existing published Webinar Registered Workflow was read at version 67;
its tag action already adds `28oct2026-registered` and `webinar-registrant`.
No workflow was edited or published in this migration. Existing tags were not
renamed/deleted. Registration tag count is a CRM cohort count, not a replacement
for WebinarJam's 274 imported unique registration records.

## Attendance reconciliation follow-up

WebinarJam's registrants API supplies Yes/No attendance flags; the previous
registration adapter dropped them. Added a session/email attendance importer that
preserves unknowns and does not mark future registrants absent. Flags are stored
as provider evidence, separately from aggregate peak/pitch.

The saved TCS001 provider evidence identified 90 live attendees; 84 linked to GHL
contact IDs received 14oct2026-attended. Six lacked a linked GHL ID and were not
assigned to guessed CRM contacts. No registration was treated as attendance proof.
Attendance tag backfill was additive; no generic tags were changed.

New imports match exact provider schedule/event IDs. If the provider reassigns
registrants to another event, existing historical evidence is retained rather than
cleared because the row disappears from a later result. This does not resolve the
historical Analytics-versus-API aggregate discrepancy.

Future provider attendance storage is wired into successful webinar syncs.
Automatic GHL attended-tag propagation is not yet wired; it remains part of TCS002
end-to-end QA. This follow-up performed the TCS001 GHL tag backfill explicitly.
