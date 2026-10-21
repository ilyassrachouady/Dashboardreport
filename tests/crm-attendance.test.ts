import test from "node:test";
import assert from "node:assert/strict";
import { normalizeAttendance, crmAttendanceRows } from "../lib/crm-attendance";
import { emptyDataset } from "../lib/model";
test("normalizes CRM attendance text while preserving unknown values as unrecognised", () => {
  assert.equal(normalizeAttendance(" Attended "), "Attended");
  assert.equal(normalizeAttendance("No_Show"), "No Show");
  assert.equal(normalizeAttendance("no-show"), "No Show");
  assert.equal(normalizeAttendance("Canceled"), "Cancelled");
  assert.equal(normalizeAttendance("rescheduled"), "Rescheduled");
  assert.equal(normalizeAttendance("maybe"), "Unrecognised");
});
test("counts current contact status once and excludes blank fields", () => {
  const d = emptyDataset();
  d.crmAttendance = [
    { ghl_contact_id: "one", value: "Attended" },
    { ghl_contact_id: "one", value: "No Show" },
    { ghl_contact_id: "two", value: "Cancelled" },
    { ghl_contact_id: "blank", value: " " },
  ];
  const rows = crmAttendanceRows(d);
  assert.equal(rows.length, 2);
  assert.equal(rows.find((r) => r.ghl_contact_id === "one")?.status, "No Show");
});
