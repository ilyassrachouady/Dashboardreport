import test from "node:test";
import assert from "node:assert/strict";
import { countWebinarCohort } from "../lib/integrations/ghl-webinar";
test("applicants require exact cohort tag and Yes; identities are counted once", () => {
  const fields = { application_submitted: "a", appointment_booked_date: "b" };
  const person = (id: string, tags: string[], value: unknown) => ({
    id,
    tags,
    customFields: [{ id: "a", value }],
  });
  const yes = person("1", ["14-october-2026-webinar"], "Yes");
  const result = countWebinarCohort(
    [
      yes,
      yes,
      person("2", ["14-october-2026-webinar"], " yes "),
      person("3", ["other-webinar"], "Yes"),
      person("4", ["14-october-2026-webinar"], "No"),
      person("5", ["14-october-2026-webinar"], null),
    ],
    "14-october-2026-webinar",
    fields,
  );
  assert.equal(result.tagged_contacts, 4);
  assert.equal(result.application_count, 2);
  assert.equal(result.contacts_with_booking_date, 0);
});
test("empty or missing field mapping is not silently converted into zero applicants", () => {
  assert.throws(() => countWebinarCohort([], "tag", {}));
});
