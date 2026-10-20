import test from "node:test";
import assert from "node:assert/strict";
import { emptyDataset } from "../lib/model";
import {
  isPifPaymentType,
  isVerifiedPifSale,
  salesPerformance,
} from "../lib/sales-performance";

test("recognizes Payment Desk PIF labels", () => {
  assert.equal(isPifPaymentType("pif"), true);
  assert.equal(isPifPaymentType("Pay in Full"), true);
  assert.equal(isPifPaymentType("payment_plan"), false);
});

test("requires one successful full receipt to verify PIF", () => {
  const sale = {
    id: "sale-1",
    contact_id: "contact-1",
    sales_call_id: "call-1",
    offer: "Coaching",
    payment_type: "pif",
    contract_value: 199700,
    sold_at: "2026-10-20T10:00:00Z",
  };
  assert.equal(
    isVerifiedPifSale(sale, [
      {
        id: "payment-1",
        contact_id: "contact-1",
        sale_id: "sale-1",
        provider: "whop",
        external_payment_id: "pay-1",
        amount: 199700,
        status: "succeeded",
        paid_at: "2026-10-20T10:01:00Z",
      },
    ]),
    true,
  );
  assert.equal(
    isVerifiedPifSale(sale, [
      {
        id: "payment-1",
        contact_id: "contact-1",
        sale_id: "sale-1",
        provider: "whop",
        external_payment_id: "pay-1",
        amount: 100000,
        status: "succeeded",
        paid_at: "2026-10-20T10:01:00Z",
      },
      {
        id: "payment-2",
        contact_id: "contact-1",
        sale_id: "sale-1",
        provider: "whop",
        external_payment_id: "pay-2",
        amount: 99700,
        status: "succeeded",
        paid_at: "2026-10-21T10:01:00Z",
      },
    ]),
    false,
  );
});

test("calculates closer cash per attended call and PIF rate", () => {
  const data = emptyDataset();
  data.contacts.push({
    id: "contact-1",
    ghl_contact_id: "ghl-1",
    email: "buyer@example.com",
    phone: null,
    first_name: "Buyer",
    last_name: "One",
    trakyo_id: null,
    created_at: "2026-10-20T09:00:00Z",
  });
  data.calls.push(
    {
      id: "call-1",
      contact_id: "contact-1",
      appointment_id: null,
      call_date: "2026-10-20T10:00:00Z",
      closer: "Lewis Kirby",
      attendance: "attended",
      outcome: "sold",
      recording_url: null,
    },
    {
      id: "call-2",
      contact_id: "contact-1",
      appointment_id: null,
      call_date: "2026-10-21T10:00:00Z",
      closer: "Lewis Kirby",
      attendance: "attended",
      outcome: "no_sale",
      recording_url: null,
    },
  );
  data.sales.push({
    id: "sale-1",
    contact_id: "contact-1",
    sales_call_id: "call-1",
    offer: "Coaching",
    payment_type: "pif",
    contract_value: 200000,
    sold_at: "2026-10-20T10:00:00Z",
  });
  data.payments.push({
    id: "payment-1",
    contact_id: "contact-1",
    sale_id: "sale-1",
    provider: "whop",
    external_payment_id: "pay-1",
    amount: 200000,
    status: "succeeded",
    paid_at: "2026-10-20T10:01:00Z",
  });

  const result = salesPerformance(data);
  assert.equal(result.attended, 2);
  assert.equal(result.sales, 1);
  assert.equal(result.verifiedPif, 1);
  assert.equal(result.pifRate, 1);
  assert.equal(result.cash, 200000);
  assert.equal(result.cashPerAttendedCall, 100000);
  assert.equal(result.closers[0].closeRate, 0.5);
  assert.equal(result.closers[0].cashPerAttendedCall, 100000);
});
