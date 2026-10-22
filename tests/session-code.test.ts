import test from "node:test";
import assert from "node:assert/strict";
import { assignMissingSessionCodes, changeClientSeries, nextSessionCode } from "../lib/session-code";
test("session codes count separately for each client and never reuse a released code", () => {
  const rows: Array<{ id: string; session_code: string; client_series: string; released_codes: string }> =
    assignMissingSessionCodes([
      { id: "b", webinar_date: "2026-10-28T00:00:00Z", session_code: null, client_series: "TCS", released_codes: "" },
      { id: "a", webinar_date: "2026-10-14T00:00:00Z", session_code: null, client_series: null, released_codes: "" },
    ]);
  assert.deepEqual(rows.map((row) => [row.id, row.session_code]), [["a", "TCS001"], ["b", "TCS002"]]);
  const queen = changeClientSeries(
    [{ id: "c", webinar_date: "2026-11-01", session_code: "TCS003", client_series: "TCS", released_codes: "" }, ...rows],
    "c",
    "QUE",
  );
  assert.equal(queen.session_code, "QUE001");
  assert.equal(nextSessionCode(["TCS001", "TCS002", "TCS003", "QUE001"], "TCS"), "TCS004");
});
