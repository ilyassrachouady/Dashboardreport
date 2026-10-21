import test from "node:test";
import assert from "node:assert/strict";
import { crmCashCents, crmCloserCash } from "../lib/crm-cash";
import { emptyDataset } from "../lib/model";
import { salesPerformance } from "../lib/sales-performance";
test("CRM dollars convert exactly, with blanks and invalid data remaining unknown", () => {
  assert.equal(crmCashCents(800), 80000);
  assert.equal(crmCashCents("1997.50"), 199750);
  assert.equal(crmCashCents(0), 0);
  for (const v of ["", null, undefined, "$800", "1.005", -1, "abc"])
    assert.equal(crmCashCents(v), null);
});
test("current CRM cash is counted once per contact and assigned to the latest call closer without inventing Whop receipts", () => {
  const d = emptyDataset();
  d.contacts = [
    {
      id: "c",
      ghl_contact_id: "ghl",
      email: null,
      phone: null,
      first_name: "Test",
      last_name: "",
      trakyo_id: null,
      created_at: "2026-01-01",
    },
  ];
  d.calls = [
    {
      id: "a",
      contact_id: "c",
      appointment_id: null,
      call_date: "2026-10-20",
      closer: "Old",
      attendance: "attended",
      outcome: "sold",
      recording_url: null,
    },
    {
      id: "b",
      contact_id: "c",
      appointment_id: null,
      call_date: "2026-10-21",
      closer: "Brooklyn",
      attendance: "attended",
      outcome: "sold",
      recording_url: null,
    },
  ];
  d.crmCash = [{ ghl_contact_id: "ghl", cashCents: 80000 }];
  assert.equal(crmCloserCash(d).total, 80000);
  assert.equal(crmCloserCash(d).entries.length, 1);
  const m = salesPerformance(d);
  assert.equal(m.crmCash, 80000);
  assert.equal(m.cash, 0);
  assert.equal(m.crmCashPerAttendedCall, 40000);
  assert.equal(m.closers.find((c) => c.closer === "Old")?.crmCash, null);
  assert.equal(m.closers.find((c) => c.closer === "Brooklyn")?.crmCash, 80000);
  d.crmCashError = "Unavailable";
  assert.equal(crmCloserCash(d).total, null);
});
