import test from "node:test";
import assert from "node:assert/strict";
import {
  bookingWebinar,
  bookingSchema,
  isBooked,
} from "../lib/integrations/ghl-bookings";
const session = (id: string, date: string) => ({
  id,
  external_id: id,
  webinar_date: date,
});
const event = bookingSchema.parse({
  id: "event",
  locationId: "loc",
  calendarId: "cal",
  contactId: "person",
  startTime: "2026-10-20T10:00:00Z",
  dateAdded: "2026-10-15T01:00:00Z",
  appointmentStatus: "confirmed",
});
test("bookings use creation date and latest matching past session, never future or unmatched sessions", () => {
  const sessions = [
    session("old", "2026-10-01T00:00:00Z"),
    session("current", "2026-10-15T00:00:00Z"),
    session("future", "2026-10-16T00:00:00Z"),
  ];
  assert.equal(
    bookingWebinar(event, ["old", "current", "future"], sessions, {
      old: "old",
      current: "current",
      future: "future",
    }),
    "current",
  );
  assert.equal(
    bookingWebinar(event, ["other"], sessions, { current: "current" }),
    null,
  );
  assert.equal(
    bookingWebinar(
      { ...event, dateAdded: "2026-09-01T00:00:00Z" },
      ["current"],
      sessions,
      { current: "current" },
    ),
    null,
  );
  assert.throws(() =>
    bookingWebinar({ ...event, startTime: "bad" }, [], sessions, {}),
  );
});
test("cancelled, invalid and deleted bookings never enter active booked counts", () => {
  for (const status of [
    "cancelled",
    "canceled",
    "invalid",
    "deleted",
    "CANCELLED",
  ])
    assert.equal(isBooked(status), false);
  for (const status of ["confirmed", "new", "showed", "noshow"])
    assert.equal(isBooked(status), true);
});
