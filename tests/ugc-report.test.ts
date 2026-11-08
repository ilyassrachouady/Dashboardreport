import test from "node:test";
import assert from "node:assert/strict";
import { buildUgcReport } from "../lib/ugc-report";
const event = {
  pageId: "ugc-page",
  name: "UGC Training",
  webinar_date: "2026-11-10T18:00:00Z",
  peak_attendees: 2,
  pitch_attendees: 1,
};
const details = {
  webinar_id: 2,
  name: "UGC",
  timezone: "Europe/Berlin",
  schedules: [
    { schedule: 3, date: "2026-11-08 13:00" },
    { schedule: 4, date: "2026-11-10 19:00" },
  ],
};
const row = {
  id: 1,
  email: "one@example.com",
  schedule_id: 4,
  event_id: 4,
  signup_date: "2026-11-06 10:00",
  event: "2026-11-10 19:00",
  attended_live: "Yes",
  attended_replay: "No",
};
function fixture() {
  return {
    locationId: "ugc",
    contacts: [
      {
        id: "1",
        locationId: "ugc",
        email: "one@example.com",
        customFields: [{ id: "source", value: "instagram" }],
      },
    ],
    fields: [{ id: "source", fieldKey: "contact.utm_source" }],
    events: [event],
    providers: [
      {
        details,
        registrants: [
          row,
          {
            ...row,
            id: 2,
            email: "two@example.com",
            attended_live: "No",
            utm_source: "skool",
          },
          { ...row, id: 3 },
        ],
      },
    ],
    now: Date.parse("2026-11-11T12:00Z"),
  };
}
test("UGC uses only its current occurrence, deduplicates people and resolves source from its own CRM", () => {
  const input = fixture();
  input.providers[0].registrants.push({
    ...row,
    id: 4,
    schedule_id: 3,
    event_id: 3,
    event: "2026-11-08 13:00",
    email: "past@example.com",
  });
  const report = buildUgcReport(input);
  const s = report.sessions[0];
  assert.equal(report.client, "ugc");
  assert.equal(s.registrants, 2);
  assert.equal(s.registrationRecords, 3);
  assert.equal(s.liveAttendees, 1);
  assert.equal(s.crmMatched, 1);
  assert.deepEqual(s.sources, [
    { name: "Instagram", count: 1 },
    { name: "Skool", count: 1 },
  ]);
  assert.equal(s.attendanceRate, 1);
  assert.equal(s.retentionRate, 0.5);
  assert.equal("payments" in report, false);
  assert.equal(JSON.stringify(report).includes("one@example.com"), false);
});
test("UGC rejects cross-account CRM contacts and ambiguous schedules", () => {
  const input = fixture();
  input.contacts[0].locationId = "tcs";
  assert.throws(() => buildUgcReport(input), /identity mismatch/);
  const other = fixture();
  other.providers.push({ ...other.providers[0] });
  assert.throws(() => buildUgcReport(other), /unique matching/);
});
test("unknown/future attendance stays unavailable and impossible manual inputs are flagged", () => {
  const input = fixture();
  input.now = Date.parse("2026-11-06");
  let s = buildUgcReport(input).sessions[0];
  assert.equal(s.liveAttendees, null);
  input.now = Date.parse("2026-11-11");
  input.providers[0].registrants.forEach((r) => (r.attended_live = "unknown"));
  s = buildUgcReport(input).sessions[0];
  assert.equal(s.liveAttendees, null);
  input.events[0].peak_attendees = 5;
  input.events[0].pitch_attendees = 7;
  s = buildUgcReport(input).sessions[0];
  assert.equal(s.attendanceRate, null);
  assert.equal(s.retentionRate, null);
  assert.equal(s.issues.length, 2);
});
test("duplicate CRM email identities are never chosen as a source match", () => {
  const input = fixture();
  input.contacts.push({ ...input.contacts[0], id: "other" });
  const s = buildUgcReport(input).sessions[0];
  assert.equal(s.crmMatched, 0);
  assert.ok(s.sources.some((s) => s.name === "Unattributed"));
});
test("UGC rescheduled rows follow their explicit event date and unmatched Notion events stop loading", () => {
  const input = fixture();
  input.providers[0].registrants[0].schedule_id = 3;
  assert.equal(buildUgcReport(input).sessions[0].registrants, 2);
  input.events[0].webinar_date = "2026-11-12T18:00Z";
  assert.throws(() => buildUgcReport(input), /unique matching/);
});
