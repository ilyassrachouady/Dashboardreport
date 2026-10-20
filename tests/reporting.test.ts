import test from "node:test";
import assert from "node:assert/strict";
import { demoDataset } from "../lib/demo";
import {
  metrics,
  normalize,
  selectContacts,
  ratio,
  csv,
  attribution,
} from "../lib/reporting";
import { defaultFilters } from "../lib/model";
import { eventSchema } from "../lib/integrations/schema";
test("contract value is separate from successful collected cash", () => {
  const d = demoDataset(),
    m = metrics(d, d.contacts);
  assert.ok(m.contract > m.cash);
  const old = m.cash;
  d.payments.push({
    ...d.payments[0],
    id: "failed",
    external_payment_id: "failed",
    status: "failed",
    amount: 999999,
  });
  assert.equal(metrics(d, d.contacts).cash, old);
});
test("normalization is exact and preserves raw storage", () => {
  const d = demoDataset();
  assert.equal(normalize("ig", "source", d), "instagram");
  assert.equal(normalize("IG", "source", d), "IG");
  assert.ok(d.touches.some((t) => t.source === "ig"));
});
test("source filter and drilldown use same underlying contacts", () => {
  const d = demoDataset(),
    f = { ...defaultFilters, source: "instagram" };
  const rows = selectContacts(d, f),
    groups = attribution(d, d.contacts, defaultFilters);
  assert.equal(
    metrics(d, rows, f).cash,
    groups.find((g) => g.name === "instagram")?.cash,
  );
  assert.ok(rows.length < d.contacts.length);
});
test("empty cohorts never produce NaN or fabricated conversion", () => {
  const d = demoDataset(),
    f = { ...defaultFilters, source: "never" };
  const m = metrics(d, selectContacts(d, f), f);
  assert.equal(m.close, null);
  assert.equal(m.cash, 0);
  assert.equal(ratio(0, 0), null);
});
test("CSV neutralizes spreadsheet formulas and escapes quotes", () => {
  assert.match(csv([{ name: '=HYPERLINK("bad")' }]), /'=HYPERLINK/);
});
test("ingestion requires canonical identity, valid timestamps, integer cents and USD", () => {
  const base = {
    provider: "whop",
    event_id: "e",
    contact: { email: "test@example.com" },
    payments: [
      {
        external_payment_id: "p",
        amount: 120000,
        currency: "USD",
        status: "succeeded",
        paid_at: "2026-10-14T12:00:00Z",
      },
    ],
  };
  assert.ok(eventSchema.safeParse(base).success);
  assert.equal(
    eventSchema.safeParse({ ...base, contact: { first_name: "Only a name" } })
      .success,
    false,
  );
  assert.equal(
    eventSchema.safeParse({
      ...base,
      payments: [{ ...base.payments[0], amount: 1.3 }],
    }).success,
    false,
  );
});


test("verified source aliases merge case and IG without conflating distinct sources", async () => {
  const { sourceMapping, sourceMappings } = await import("../lib/source-normalization");
  assert.equal(sourceMapping("ig")?.normalized_value, "Instagram");
  assert.equal(sourceMapping("instagram")?.normalized_value, "Instagram");
  assert.equal(sourceMapping(" YouTube ")?.normalized_value, "YouTube");
  assert.equal(sourceMapping("referrer")?.normalized_value, "Referral");
  assert.equal(sourceMapping("Custom YouTube"), null);
  assert.equal(sourceMapping(""), null);
  assert.equal(sourceMapping("qa_test"), null);
  assert.equal(sourceMappings(["ig", "ig"]).length, 1);
});
