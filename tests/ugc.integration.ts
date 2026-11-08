import test from "node:test";
import assert from "node:assert/strict";
import { loadUgcReport } from "../lib/load-ugc-report";
const page = "11111111-1111-4111-8111-111111111111",
  source = "22222222-2222-4222-8222-222222222222",
  client = "33333333-3333-4333-8333-333333333333";
const properties = {
  Name: { title: [{ plain_text: "UGC Training" }] },
  Client: { relation: [{ id: client }], has_more: false },
  "Start Date": { type: "date", date: { start: "2026-11-10T19:00:00+01:00" } },
  "End Time": {
    type: "formula",
    formula: { type: "date", date: { start: "2026-11-10T21:00:00+01:00" } },
  },
  "Attendees at Peak": { type: "number", number: null },
  "Attendees at Pitch": { type: "number", number: null },
  Slides: { type: "url", url: null },
  "Replay Link": { type: "url", url: null },
  "Link for Presenter": { type: "url", url: null },
  Registrants: { type: "number", number: 0 },
};
const event = () => ({
  id: page,
  url: "https://notion.so/" + page,
  last_edited_time: "2026-11-06T10:00Z",
  parent: { data_source_id: source },
  properties,
});
test("UGC sends only UGC credentials to its providers and writes only its exact Notion row", async () => {
  const originalFetch = global.fetch,
    keys = [
      "UGC_GHL_API_KEY",
      "UGC_GHL_LOCATION_ID",
      "UGC_WEBINARJAM_API_KEY",
      "UGC_WEBINARJAM_WEBINAR_ID",
      "UGC_NOTION_PAGE_ID",
      "UGC_NOTION_CLIENT_ID",
      "GHL_API_KEY",
      "GHL_LOCATION_ID",
      "WEBINARJAM_API_KEY",
      "NOTION_API_KEY",
      "NOTION_DATABASE_ID",
    ];
  const original = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  Object.assign(process.env, {
    UGC_GHL_API_KEY: "ugc-crm",
    UGC_GHL_LOCATION_ID: "ugc-location",
    UGC_WEBINARJAM_API_KEY: "ugc-webinar",
    UGC_WEBINARJAM_WEBINAR_ID: "2",
    UGC_NOTION_PAGE_ID: page,
    UGC_NOTION_CLIENT_ID: client,
    GHL_API_KEY: "tcs-crm",
    GHL_LOCATION_ID: "tcs-location",
    WEBINARJAM_API_KEY: "tcs-webinar",
    NOTION_API_KEY: "shared-notion",
    NOTION_DATABASE_ID: "44444444-4444-4444-8444-444444444444",
  });
  const writes: string[] = [];
  global.fetch = async (input, init) => {
    const url = new URL(String(input)),
      headers = new Headers(init?.headers);
    const json = (body: unknown) => Response.json(body);
    if (url.hostname === "services.leadconnectorhq.com") {
      assert.equal(headers.get("Authorization"), "Bearer ugc-crm");
      if (url.pathname === "/contacts/search") {
        assert.equal(JSON.parse(String(init?.body)).locationId, "ugc-location");
        return json({
          contacts: [
            {
              id: "person",
              locationId: "ugc-location",
              email: "one@example.com",
              customFields: [],
            },
          ],
        });
      }
      assert.equal(url.pathname, "/locations/ugc-location/customFields");
      return json({ customFields: [] });
    }
    if (url.hostname === "api.webinarjam.com") {
      assert.equal(
        new URLSearchParams(String(init?.body)).get("api_key"),
        "ugc-webinar",
      );
      if (url.pathname.endsWith("/webinar"))
        return json({
          status: "success",
          webinar: {
            webinar_id: 2,
            name: "UGC",
            timezone: "Europe/Berlin",
            schedules: [{ schedule: 4, date: "2026-11-10 19:00" }],
          },
        });
      return json({
        status: "success",
        registrants: {
          data: [
            {
              id: 1,
              email: "one@example.com",
              schedule_id: 4,
              event_id: 4,
              event: "2026-11-10 19:00",
              signup_date: "2026-11-06 10:00",
            },
          ],
          current_page: 1,
          last_page: 1,
          total: 1,
        },
      });
    }
    assert.equal(url.hostname, "api.notion.com");
    assert.equal(headers.get("Authorization"), "Bearer shared-notion");
    if (url.pathname.includes("/databases/"))
      return json({ data_sources: [{ id: source }] });
    if (url.pathname.includes("/query")) {
      assert.equal(
        JSON.parse(String(init?.body)).filter.relation.contains,
        client.replaceAll("-", ""),
      );
      return json({ results: [event()], has_more: false });
    }
    assert.equal(url.pathname, "/v1/pages/" + page.replaceAll("-", ""));
    if (init?.method === "PATCH") {
      writes.push(url.pathname);
      assert.deepEqual(JSON.parse(String(init.body)), {
        properties: { Registrants: { number: 1 } },
      });
      properties.Registrants.number = 1;
    }
    return json(event());
  };
  try {
    const result = await loadUgcReport(true);
    assert.equal(result.sessions[0].registrants, 1);
    assert.equal(writes.length, 1);
    delete process.env.UGC_WEBINARJAM_API_KEY;
    await assert.rejects(loadUgcReport(), /not configured/);
    process.env.UGC_WEBINARJAM_API_KEY = "tcs-webinar";
    await assert.rejects(loadUgcReport(), /separate/);
  } finally {
    global.fetch = originalFetch;
    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  }
});
