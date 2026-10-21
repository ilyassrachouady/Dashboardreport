import "server-only";
import { unstable_cache } from "next/cache";
import { z } from "zod";
import { fetchGhlContacts, fetchGhlFieldMap } from "./ghl";

// Current contact-level classification; never presented as historical agreement data.
export const fetchCrmPaymentStructures = unstable_cache(
  async (location: string) => {
    if (location !== process.env.GHL_LOCATION_ID)
      throw new Error("GHL location mismatch");
    const [contacts, fields] = await Promise.all([
      fetchGhlContacts(),
      fetchGhlFieldMap(),
    ]);
    if (!fields.payment_structure)
      throw new Error("GHL Payment Structure field is missing");
    const rows = contacts.flatMap((raw) => {
      const c = z
        .object({
          id: z.string(),
          locationId: z.string(),
          customFields: z
            .array(z.object({ id: z.string(), value: z.unknown() }))
            .optional(),
        })
        .parse(raw);
      if (c.locationId !== location) throw new Error("GHL location mismatch");
      const value = c.customFields?.find(
        (f) => f.id === fields.payment_structure,
      )?.value;
      return typeof value === "string" && value.trim()
        ? [{ ghl_contact_id: c.id, value: value.trim() }]
        : [];
    });
    return { rows, fetchedAt: new Date().toISOString() };
  },
  ["crm-payment-structure-v1"],
  { revalidate: 300 },
);

export const fetchTrakyoTransactions = unstable_cache(
  async () => {
    if (!process.env.TRAKYO_API_KEY)
      throw new Error("Trakyo is not configured");
    const row = z.object({
      id: z.string(),
      lead_id: z.string().nullable(),
      reference_number: z.string().nullable(),
      transaction_date: z.string(),
      payment_method: z.string().nullable(),
    });
    const results: z.infer<typeof row>[] = [],
      ids = new Set<string>(),
      cursors = new Set<string>();
    let cursor: string | undefined;
    for (let page = 0; page < 200; page++) {
      const url = new URL("https://api.trakyo.io/v1/transactions");
      url.searchParams.set("type", "whop_payment");
      url.searchParams.set("limit", "500");
      if (cursor) url.searchParams.set("starting_after", cursor);
      const r = await fetch(url, {
        headers: { Authorization: `Bearer ${process.env.TRAKYO_API_KEY}` },
        signal: AbortSignal.timeout(20000),
        cache: "no-store",
      });
      if (!r.ok)
        throw new Error(
          r.status === 403
            ? "Trakyo needs transactions:read permission"
            : "Trakyo transaction history unavailable",
        );
      const b = z
        .object({
          data: z.array(row),
          has_more: z.boolean(),
          next_cursor: z.string().nullable(),
        })
        .parse(await r.json());
      for (const item of b.data) {
        if (ids.has(item.id)) throw new Error("Repeated Trakyo transaction");
        ids.add(item.id);
        results.push(item);
      }
      if (!b.has_more) return results;
      if (!b.next_cursor || cursors.has(b.next_cursor))
        throw new Error("Invalid Trakyo transaction cursor");
      cursor = b.next_cursor;
      cursors.add(cursor);
    }
    throw new Error("Trakyo transaction batch limit reached");
  },
  ["trakyo-whop-transactions-v1"],
  { revalidate: 300 },
);
