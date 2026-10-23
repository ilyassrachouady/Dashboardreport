import test from "node:test";
import assert from "node:assert/strict";
import { emptyDataset } from "../lib/model";
import { webinarKpis } from "../lib/webinar-kpis";
test("five webinar rates use the requested denominators and booked applicants only", () => {
  const d = emptyDataset();
  const w = {
    id: "w1",
    external_id: "ext1",
    name: "Test",
    webinar_date: "2026-10-14T19:00:00Z",
    peak_attendees: 72,
    pitch_attendees: 60,
    application_count: 12,
    call_booked_count: 10,
    applicant_booked_count: 6,
  };
  d.registrations = Array.from({ length: 100 }, (_, i) => ({
    id: String(i),
    contact_id: `c${i}`,
    webinar_id: "w1",
    registered_at: "2026-10-14T10:00:00Z",
    raw_utm_source: "",
    raw_utm_medium: "",
    raw_utm_campaign: "",
    raw_utm_content: "",
  }));
  d.registrations.push(
    { ...d.registrations[0], id: "duplicate" },
    { ...d.registrations[0], id: "other", webinar_id: "w2" },
  );
  const k = webinarKpis(d, w);
  assert.equal(k.registrants, 100);
  assert.equal(k.attendance, 0.72);
  assert.equal(k.retention, 60 / 72);
  assert.equal(k.application, 0.2);
  assert.equal(k.booking, 10 / 60);
  assert.equal(k.applicantBooking, 0.5);
});
test("missing counts and zero denominators never produce a fabricated zero rate", () => {
  const d = emptyDataset();
  const w = {
    id: "w",
    external_id: "e",
    name: "Test",
    webinar_date: "2026-10-14T19:00:00Z",
    peak_attendees: null,
    pitch_attendees: null,
  };
  const k = webinarKpis(d, w);
  assert.equal(k.attendance, null);
  assert.equal(k.retention, null);
  assert.equal(k.application, null);
  assert.equal(k.booking, null);
  assert.equal(k.applicantBooking, null);
  assert.equal(
    webinarKpis(d, { ...w, application_count: 10, applicant_booked_count: 0 })
      .applicantBooking,
    0,
  );
});

test("contradictory audience and applicant subsets do not display valid-looking conversion rates", () => {
 const d=emptyDataset();
 const w={id:"w",external_id:"e",name:"Invalid",webinar_date:"2026-10-14T19:00:00Z",peak_attendees:72,pitch_attendees:80,application_count:10,call_booked_count:5,applicant_booked_count:12};
 const k=webinarKpis(d,w);
 assert.equal(k.attendance,null);assert.equal(k.retention,null);assert.equal(k.applicantBooking,null);assert.equal(k.issues.length,4);
});
