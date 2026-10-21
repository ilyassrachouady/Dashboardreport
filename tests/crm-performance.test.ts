import test from "node:test";
import assert from "node:assert/strict";
import { emptyDataset } from "../lib/model";
import { crmPerformance } from "../lib/crm-performance";
import { normalizeStructure } from "../lib/payment-analytics";
test("PIF and other plan counts come only from CRM and count each contact once without requiring Whop receipts", () => {
  const d = emptyDataset();
  const row = {
    ghl_contact_id: "pif",
    closer: "Brooklyn",
    attendance: "Attended",
    outcome: "Sold",
    structure: "Pay in Full (PIF)",
    cashCents: 199700,
    contractCents: 199700,
  };
  d.crmCallSnapshots = [
    row,
    { ...row },
    {
      ...row,
      ghl_contact_id: "manual",
      structure: "Manual Payment Plan",
      cashCents: 80000,
      contractCents: 240000,
    },
    { ...row, ghl_contact_id: "financed", structure: "Financing" },
    { ...row, ghl_contact_id: "blank", structure: "", cashCents: null },
  ];
  const p = crmPerformance(d);
  assert.equal(p.contacts, 4);
  assert.equal(p.pif, 1);
  assert.equal(p.manual, 1);
  assert.equal(p.financing, 1);
  assert.equal(p.pifRate, 1 / 3);
  assert.equal(p.missingPlans, 1);
  assert.equal(p.cash, 479400);
  assert.equal(p.closers[0].pif, 1);
  assert.equal(d.whopPayments, undefined);
});
test("blank plans produce an unknown PIF share, and missing CRM closer never falls back to a recorded app closer", () => {
  assert.equal(normalizeStructure("two"), "Unknown");
  assert.equal(normalizeStructure("custom"), "Unknown");
  const d = emptyDataset();
  d.crmCallSnapshots = [
    {
      ghl_contact_id: "c",
      closer: "",
      attendance: "No Show",
      outcome: "",
      structure: "",
      cashCents: null,
      contractCents: null,
    },
  ];
  const p = crmPerformance(d);
  assert.equal(p.pifRate, null);
  assert.equal(p.closers[0].closer, "Unassigned");
  assert.equal(p.cash, null);
  assert.equal(p.attended, 0);
});
