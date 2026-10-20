import test from "node:test";
import assert from "node:assert/strict";
import {
  adaptWhopPayment,
  minorAmount,
} from "../lib/integrations/whop-history";
import { reportingPayments } from "../lib/payment-history";
import { metrics } from "../lib/reporting";
import { demoDataset } from "../lib/demo";
import { defaultFilters } from "../lib/model";
const money = (amount: string, currency = "usd") => ({
  amount,
  currency,
  decimals: 2,
});
const payment = (overrides: Record<string, unknown> = {}) => ({
  id: "pay_native",
  account_id: "biz",
  status: "paid",
  substatus: "succeeded",
  currency: "usd",
  total: money("1997.00"),
  refunded_amount: money("0.00"),
  paid_at: "2026-10-19T10:00:00Z",
  created_at: "2026-10-19T09:00:00Z",
  ...overrides,
});
test("Whop money objects convert exact decimals to minor units and preserve failure/refund states", () => {
  assert.equal(minorAmount(money("1997.01")), 199701);
  assert.throws(() => minorAmount(money("1.005")));
  assert.equal(adaptWhopPayment(payment(), "biz").net, 199700);
  assert.equal(
    adaptWhopPayment(payment({ status: "open", substatus: "failed" }), "biz")
      .status,
    "failed",
  );
  assert.equal(
    adaptWhopPayment(payment({ refunded_amount: money("100.00") }), "biz").net,
    189700,
  );
  assert.throws(() => adaptWhopPayment(payment(), "other"));
  assert.throws(() =>
    adaptWhopPayment(payment({ total: money("100", "cad") }), "biz"),
  );
});
test("company cash includes unmatched successful USD history, never failed attempts or CAD, and does not invent sales or source matches", () => {
  const d = demoDataset();
  d.payments = [];
  d.whopPayments = [
    adaptWhopPayment(payment(), "biz"),
    adaptWhopPayment(
      payment({ id: "failed", status: "open", substatus: "blocked" }),
      "biz",
    ),
    adaptWhopPayment(
      payment({
        id: "cad",
        currency: "cad",
        total: money("200", "cad"),
        refunded_amount: money("0", "cad"),
      }),
      "biz",
    ),
  ];
  const beforeSales = d.sales.length;
  assert.equal(metrics(d, d.contacts, defaultFilters).cash, 199700);
  assert.equal(metrics(d, [d.contacts[0]], defaultFilters).cash, 0);
  assert.equal(
    metrics(d, d.contacts, { ...defaultFilters, closer: "Someone" }).cash,
    0,
  );
  assert.equal(metrics(d, d.contacts).cpc, 0);
  assert.equal(d.sales.length, beforeSales);
});
test("provider payment IDs deduplicate Desk receipts and native history while retaining verified sale links", () => {
  const d = demoDataset(),
    existing = d.payments[0];
  existing.provider = "whop";
  existing.external_payment_id = "pay_native";
  d.whopPayments = [
    adaptWhopPayment(
      payment({ total: money((existing.amount / 100).toFixed(2)) }),
      "biz",
    ),
  ];
  const rows = reportingPayments(d).filter(
    (p) => p.external_payment_id === "pay_native",
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].sale_id, existing.sale_id);
  assert.equal(rows[0].contact_id, existing.contact_id);
});
