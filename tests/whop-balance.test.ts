import test from "node:test";
import assert from "node:assert/strict";
import { adaptWhopBalance } from "../lib/integrations/whop-balance";
const raw = {
  id: "biz",
  total_usd: "7443.53",
  balances: [
    {
      symbol: "USD",
      balance: "6480.59",
      value_usd: "6480.59",
      breakdown: { available: "4329.97", pending: "1811.42", reserve: "339.2" },
    },
    {
      symbol: "CAD",
      balance: "1354.31",
      value_usd: "962.94",
      breakdown: { available: "1259.51", pending: "0.0", reserve: "94.8" },
    },
  ],
};
test("uses provider total and preserves currency balances and pending/reserve breakdown", () => {
  const b = adaptWhopBalance(raw, "biz");
  assert.equal(b.totalUsd, "7443.53");
  assert.equal(b.currencies[1].balance, "1354.31");
  assert.equal(b.currencies[0].pending, "1811.42");
  assert.throws(() => adaptWhopBalance(raw, "other"));
  assert.throws(() => adaptWhopBalance({ ...raw, total_usd: null }, "biz"));
  assert.throws(() => adaptWhopBalance({ ...raw, total_usd: "bad" }, "biz"));
});
