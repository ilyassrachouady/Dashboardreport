import { z } from "zod";
import { eventSchema } from "./schema";
const schema = z.object({
  id: z.string(),
  locationId: z.string(),
  firstName: z.string().nullish(),
  lastName: z.string().nullish(),
  email: z.string().nullish(),
  phone: z.string().nullish(),
  dateAdded: z.string().optional(),
  dateUpdated: z.string().optional(),
  attributionSource: z
    .object({
      utmSource: z.string().optional(),
      utmMedium: z.string().optional(),
      utmCampaign: z.string().optional(),
      utmContent: z.string().optional(),
    })
    .nullish(),
  lastAttributionSource: z.record(z.string(), z.unknown()).nullish(),
  customFields: z
    .array(z.object({ id: z.string(), value: z.unknown() }))
    .optional(),
});
export function adaptGhlContact(
  raw: unknown,
  location: string,
  fields: Record<string, string> = {},
) {
  const c = schema.parse(raw);
  if (c.locationId !== location) throw new Error("GHL location mismatch");
  const at = c.dateUpdated || c.dateAdded;
  if (!at) throw new Error("Provider timestamp required");
  const value = (key: string) =>
    c.customFields?.find((f) => f.id === fields[key])?.value;
  const a = c.attributionSource;
  const first = {
    source: String(value("utm_source") || a?.utmSource || ""),
    medium: String(value("utm_medium") || a?.utmMedium || ""),
    campaign: String(value("utm_campaign") || a?.utmCampaign || ""),
    content: String(value("utm_content") || a?.utmContent || ""),
  };
  const last = c.lastAttributionSource;
  const touches = [];
  const stamp = (s: string) => new Date(s).toISOString();
  if (Object.values(first).some(Boolean))
    touches.push({
      external_touch_id: `${c.id}:first:${JSON.stringify(first)}`,
      touch_type: "first_touch",
      ...first,
      occurred_at: stamp(c.dateAdded || at),
    });
  if (last && last.sessionSource) {
    touches.push({
      external_touch_id: `${c.id}:last:${JSON.stringify(last)}`,
      touch_type: "last_touch",
      source: String(last.utmSource || last.sessionSource || ""),
      medium: String(last.utmMedium || ""),
      campaign: String(last.utmCampaign || ""),
      content: String(last.utmContent || ""),
      occurred_at: stamp(String(last.timestamp || at)),
    });
  }
  const phone = c.phone?.replace(/[\s().-]/g, "");
  return eventSchema.parse({
    provider: "ghl",
    event_id: `contact:${c.id}:${at}`,
    contact: {
      ghl_contact_id: c.id,
      email: c.email || undefined,
      phone: phone && /^\+[1-9]\d{7,14}$/.test(phone) ? phone : undefined,
      first_name: c.firstName || undefined,
      last_name: c.lastName || undefined,
      created_at: c.dateAdded ? stamp(c.dateAdded) : undefined,
    },
    touches,
  });
}
export async function fetchGhlContacts(customFieldId?: string) {
  if (!process.env.GHL_API_KEY || !process.env.GHL_LOCATION_ID)
    throw new Error("Configure GHL server credentials");
  const results: unknown[] = [];
  let cursor: unknown[] | undefined;
  const seen = new Set<string>();
  for (let page = 0; page < 100; page++) {
    const response = await fetch(
      "https://services.leadconnectorhq.com/contacts/search",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.GHL_API_KEY}`,
          Version: "v3",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          locationId: process.env.GHL_LOCATION_ID,
          pageLimit: 100,
          ...(customFieldId
            ? {
                filters: [
                  {
                    field: `customFields.${customFieldId}`,
                    operator: "exists",
                  },
                ],
              }
            : {}),
          ...(cursor ? { searchAfter: cursor } : {}),
        }),
        signal: AbortSignal.timeout(20000),
        cache: "no-store",
      },
    );
    if (!response.ok)
      throw new Error(`GHL contact sync failed (${response.status})`);
    const data = await response.json();
    if (!Array.isArray(data.contacts)) throw new Error("Invalid GHL response");
    results.push(...data.contacts);
    if (data.contacts.length < 100) return results;
    const next = data.contacts.at(-1)?.searchAfter;
    if (!Array.isArray(next) || !next.length || seen.has(JSON.stringify(next)))
      throw new Error(
        "GHL pagination cursor requires configuration; refusing partial success",
      );
    seen.add(JSON.stringify(next));
    cursor = next;
  }
  throw new Error(
    "Sync batch limit reached; use a queued incremental importer",
  );
}

export async function fetchGhlFieldMap() {
  const r = await fetch(
    `https://services.leadconnectorhq.com/locations/${encodeURIComponent(process.env.GHL_LOCATION_ID!)}/customFields?model=contact`,
    {
      headers: {
        Authorization: `Bearer ${process.env.GHL_API_KEY}`,
        Version: "v3",
      },
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    },
  );
  if (!r.ok) throw new Error("GHL custom fields cannot be read");
  const body = await r.json();
  const fields = z
    .array(z.object({ id: z.string(), name: z.string(), fieldKey: z.string() }))
    .parse(body.customFields);
  const map: Record<string, string> = {};
  for (const key of [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "trakyo_lead_id",
    "trakyo_source",
    "trakyo_campaign",
    "trakyo_content",
    "trakyo_first_touch",
    "trakyo_last_touch",
    "application_submitted",
    "appointment_booked_date",
    "payment_structure",
    "cash_collected",
    "attendance",
    "call_outcome",
    "closer",
    "agreed_total_investment",
  ]) {
    const field = fields.find(
      (f) =>
        f.fieldKey === `contact.${key}` ||
        f.name.toLowerCase() === key.replaceAll("_", " "),
    );
    if (field) map[key] = field.id;
  }
  return map;
}
