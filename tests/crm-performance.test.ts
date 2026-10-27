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

test("CRM cash sums PIF and initial instalments once without substituting contract values", () => {
  const d = emptyDataset();
  const base = { closer: "Brooklyn", attendance: "Attended", outcome: "Sold" };
  d.crmCallSnapshots = [
    { ...base, ghl_contact_id: "pif", structure: "Pay in Full (PIF)", cashCents: 199700, contractCents: 199700 },
    { ...base, ghl_contact_id: "plan", structure: "Manual Payment Plan", cashCents: 80000, contractCents: 240000 },
  ];
  const result = crmPerformance(d);
  assert.equal(result.cash, 279700);
  assert.equal(result.contract, 439700);
  assert.equal(result.closers[0].cash, 279700);
});


test("show-up uses finalized GHL attendance only and deduplicates contacts", () => {
  const d = emptyDataset();
  const base = { closer: "Brooklyn", outcome: "", structure: "", cashCents: null, contractCents: null };
  d.crmCallSnapshots = ["Attended", "attended", "No Show", "Cancelled", "Rescheduled", "", "Booked"].map((attendance, i) => ({ ...base, ghl_contact_id: String(i), attendance }));
  d.crmCallSnapshots.push(d.crmCallSnapshots[0]);
  const p = crmPerformance(d);
  assert.equal(p.finalized, 3);
  assert.equal(p.noShow, 1);
  assert.equal(p.showRate, 2 / 3);
  assert.equal(p.closers[0].showRate, 2 / 3);
  assert.equal(crmPerformance(emptyDataset()).showRate, null);
});

test("AOV and Cash per Call use CRM cash, unique denominators and one filtered cohort", () => {
 const d=emptyDataset();
 const base={closer:"Brooklyn",attendance:"Attended",outcome:"Sold",structure:"Manual Payment Plan",cashCents:80000,contractCents:240000};
 d.crmCallSnapshots=[{...base,ghl_contact_id:"one"},{...base,ghl_contact_id:"one"},{...base,ghl_contact_id:"two",cashCents:199700,structure:"Pay in Full (PIF)"},{...base,ghl_contact_id:"three",outcome:"No Sale",cashCents:0}];
 const p=crmPerformance(d);
 assert.equal(p.cash,279700);assert.equal(p.aov,139850);assert.equal(p.cashPerCall,279700/3);
 assert.equal(p.closers[0].aov,p.aov);
 d.contacts=[{id:"c1",ghl_contact_id:"one",created_at:"2026-10-14T00:00:00Z"},{id:"c2",ghl_contact_id:"two",created_at:"2026-10-15T00:00:00Z"}] as typeof d.contacts;
 const {defaultFilters}=require("../lib/model");
 const selected=crmPerformance(d,{...defaultFilters,from:"2026-10-14",to:"2026-10-14"});
 assert.equal(selected.cash,80000);assert.equal(selected.sold,1);assert.equal(selected.attended,1);assert.equal(selected.aov,80000);assert.equal(selected.cashPerCall,80000);
 assert.equal(crmPerformance(emptyDataset()).aov,null);assert.equal(crmPerformance(emptyDataset()).cashPerCall,null);
});
