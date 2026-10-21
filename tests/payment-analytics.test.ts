import test from "node:test";
import assert from "node:assert/strict";
import { emptyDataset, type WhopPayment } from "../lib/model";
import {
  paymentAnalytics,
  paymentStructure,
  sameOrder,
  sameBuyer,
} from "../lib/payment-analytics";
import { matchedContact } from "../lib/payment-history";
const p = (
  id: string,
  amount: number,
  extra: Partial<WhopPayment> = {},
): WhopPayment => ({
  id,
  amount,
  refunded: 0,
  net: amount,
  status: "succeeded",
  currency: "USD",
  decimals: 2,
  paid_at: "2026-10-21T10:00:00Z",
  created_at: "2026-10-21T10:00:00Z",
  customer_name: "Same name",
  ghl_contact_id: null,
  email: null,
  checkout_session_id: null,
  ...extra,
});
test("gross includes refunded charges once, ignores failures and never adds other currencies", () => {
  const d = emptyDataset();
  d.whopPayments = [
    p("a", 10000),
    p("b", 20000, { status: "refunded", refunded: 20000, net: 0 }),
    p("failed", 50000, { status: "failed" }),
    p("cad", 30000, { currency: "CAD" }),
  ];
  const m = paymentAnalytics(d, "USD");
  assert.equal(m.gross, 30000);
  assert.equal(m.refunds, 20000);
  assert.equal(m.net, 10000);
  assert.equal(m.paid.length, 2);
  assert.equal(m.pifRate, null);
  assert.equal(paymentAnalytics(d, "USD", "2026-10-22").gross, 0);
});
test("contact counts deduplicate contacts; transaction mix excludes unknown only from classified PIF denominator", () => {
  const d = emptyDataset();
  d.crmPaymentStructures = [
    { ghl_contact_id: "ghl", value: "Pay in Full (PIF)" },
    { ghl_contact_id: "ghl", value: "Pay in Full (PIF)" },
  ];
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
  d.whopPayments = [
    p("a", 100, { ghl_contact_id: "ghl" }),
    p("b", 200, { financing_installments: 3 }),
    p("c", 300),
  ];
  const m = paymentAnalytics(d, "USD");
  assert.equal(m.structures[0].contacts, 1);
  assert.equal(m.pifRate, 1);
  assert.equal(m.structures[3].transactions, 2);
  assert.equal(paymentStructure(d, d.whopPayments[1]).value, "Unknown");
});
test("same customer does not mean same order; names and products do not establish identity", () => {
  const d = emptyDataset(),
    a = p("a", 100, { user_id: "u", plan_id: "plan" }),
    b = p("b", 100, { user_id: "u", plan_id: "plan" });
  assert.equal(sameOrder(a, b), false);
  assert.equal(sameBuyer(d, a, b), true);
  assert.equal(sameBuyer(d, p("x", 100), p("y", 100)), false);
  assert.equal(
    sameOrder({ ...a, membership_id: "m" }, { ...b, membership_id: "m" }),
    true,
  );
});
test("Trakyo enriches identity only via an exact provider reference; conflicting identities are rejected", () => {
  const d = emptyDataset();
  d.contacts = [
    {
      id: "c",
      ghl_contact_id: "ghl",
      email: null,
      phone: null,
      first_name: "Test",
      last_name: "",
      trakyo_id: "lead",
      created_at: "2026-01-01",
    },
  ];
  d.trakyoTransactions = [
    {
      id: "txn",
      reference_number: "a",
      lead_id: "lead",
      transaction_date: "2026-10-21",
      payment_method: null,
    },
  ];
  assert.equal(matchedContact(d, p("a", 100))?.id, "c");
  assert.equal(matchedContact(d, p("b", 100)), undefined);
  d.contacts.push({
    ...d.contacts[0],
    id: "other",
    ghl_contact_id: "other",
    trakyo_id: null,
  });
  assert.equal(
    matchedContact(d, p("a", 100, { ghl_contact_id: "other" })),
    undefined,
  );
});
