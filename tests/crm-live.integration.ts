import test from "node:test";
import assert from "node:assert/strict";
import { fetchCrmPaymentStructures } from "../lib/integrations/payment-context";

test("CRM fields are read fresh on every refresh, filter by reporting fields, and deduplicate contacts", async () => {
  const fetchBefore = globalThis.fetch,
    keys = ["GHL_API_KEY", "GHL_LOCATION_ID"],
    before = keys.map((k) => process.env[k]);
  Object.assign(process.env, {
    GHL_API_KEY: "test",
    GHL_LOCATION_ID: "location",
  });
  let amount = 800,
    searches = 0;
  globalThis.fetch = async (url, options) => {
    assert.equal(options?.cache, "no-store");
    if (String(url).includes("customFields?"))
      return Response.json({
        customFields: [
          {
            id: "structure",
            name: "Payment Structure",
            fieldKey: "contact.payment_structure",
          },
          {
            id: "cash",
            name: "Cash Collected",
            fieldKey: "contact.cash_collected",
          },
          {
            id: "attendance",
            name: "Attendance",
            fieldKey: "contact.attendance",
          },
        ],
      });
    const body = JSON.parse(String(options?.body));
    assert.equal(body.locationId, "location");
    assert.equal(body.filters.length, 1);
    assert.equal(body.filters[0].operator, "exists");
    assert.ok(
      [
        "customFields.structure",
        "customFields.cash",
        "customFields.attendance",
      ].includes(body.filters[0].field),
    );
    searches++;
    return Response.json({
      contacts: [
        {
          id: "contact",
          locationId: "location",
          customFields: [
            { id: "structure", value: "Manual Payment Plan" },
            { id: "cash", value: amount },
            { id: "attendance", value: "Attended" },
          ],
        },
      ],
    });
  };
  try {
    const first = await fetchCrmPaymentStructures("location");
    assert.equal(first.cashRows?.length, 1);
    assert.equal(first.cashRows?.[0].cashCents, 80000);
    amount = 1200;
    const second = await fetchCrmPaymentStructures("location");
    assert.equal(second.cashRows?.[0].cashCents, 120000);
    assert.equal(second.attendanceRows?.length, 1);
    assert.equal(searches, 6);
  } finally {
    globalThis.fetch = fetchBefore;
    keys.forEach((k, i) => {
      if (before[i] === undefined) delete process.env[k];
      else process.env[k] = before[i];
    });
  }
});
