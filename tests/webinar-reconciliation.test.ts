import test from "node:test";
import assert from "node:assert/strict";
import { verifyRegistrantPages } from "../lib/integrations/webinars";
import { registrantReview } from "../lib/webinar-reconciliation";
const row = {
  id: 1,
  schedule_id: 2,
  email: "test@example.com",
  signup_date: "2026-10-14T10:00:00Z",
};
test("pagination refuses partial or repeated records instead of reporting a complete import", () => {
  assert.throws(() => verifyRegistrantPages([row], 2), /Incomplete/);
  assert.throws(() => verifyRegistrantPages([row, row], 2), /Duplicate/);
  assert.doesNotThrow(() => verifyRegistrantPages([row, { ...row, id: 2 }], 2));
});
test("retired CSV reference does not flag the confirmed API total", () => {
  assert.equal(registrantReview("webinarjam:2:2:2", 274), null);
  assert.equal(registrantReview("another-session", 274), null);
});
