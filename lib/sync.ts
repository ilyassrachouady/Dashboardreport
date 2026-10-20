import "server-only";
import { fetchWhopHistory } from "./integrations/whop-history";
import { syncBookings } from "./sync-bookings";
import { syncWebinarCohorts } from "./sync-webinar-cohort";
import { sourceMappings } from "./source-normalization";
import { adaptTrakyoLead, fetchTrakyoLeads } from "./integrations/trakyo";
import {
  adaptWebinarRegistrant,
  fetchWebinarRegistrants,
} from "./integrations/webinars";
import { database } from "./db";
import {
  adaptGhlContact,
  fetchGhlContacts,
  fetchGhlFieldMap,
} from "./integrations/ghl";
import { fetchPaymentDeskEvents } from "./integrations/payment-desk";
import type { IngestionEvent } from "./integrations/schema";
export async function runSync(source: "ghl" | "whop" | "trakyo" | "webinars") {
  const db = database();
  const run = await db
    .from("sync_runs")
    .insert({ source, status: "running" })
    .select("id")
    .single();
  if (run.error)
    throw new Error(
      "Reporting schema unavailable. Apply and expose revenue_intelligence in Supabase first.",
    );
  let processed = 0,
    failed = 0;
  try {
    let events: IngestionEvent[] = [];
    let ghlContext:
      { contacts: unknown[]; fields: Record<string, string> } | undefined;
    if (source === "ghl") {
      const [contacts, fields] = await Promise.all([
        fetchGhlContacts(),
        fetchGhlFieldMap(),
      ]);
      await syncWebinarCohorts(contacts, fields);
      ghlContext = { contacts, fields };
      for (const c of contacts) {
        try {
          events.push(adaptGhlContact(c, process.env.GHL_LOCATION_ID!, fields));
        } catch {
          failed++;
        }
      }
    } else if (source === "trakyo") {
      for (const row of await fetchTrakyoLeads()) {
        try {
          events.push(adaptTrakyoLead(row));
        } catch {
          failed++;
        }
      }
    } else if (source === "webinars") {
      const { details, registrants } = await fetchWebinarRegistrants();
      for (const row of registrants) {
        try {
          events.push(adaptWebinarRegistrant(row, details));
        } catch {
          failed++;
        }
      }
    } else {
      await fetchWhopHistory();
      events = await fetchPaymentDeskEvents();
    }
    const mappings = sourceMappings(
      events.flatMap((e) => [
        ...e.touches.map((t) => t.source),
        ...e.registrations.map((r) => r.raw_utm_source),
      ]),
    );
    if (mappings.length) {
      // Keep explicit user mappings authoritative on subsequent imports.
      const result = await db.from("source_mappings").upsert(mappings, {
        onConflict: "dimension,raw_value",
        ignoreDuplicates: true,
      });
      if (result.error)
        throw new Error("Could not persist source normalization");
    }
    // Preserve call → sale → payment order. Individual events commit atomically; retries use immutable event IDs.
    // A small pool keeps CRM imports fast without unbounded API traffic.
    // Ledger events remain sequential because receipts depend on sales and calls.
    let next = 0;
    const worker = async () => {
      while (next < events.length) {
        const payload = events[next++];
        const result = await db.rpc("ingest_contact_event", { payload });
        if (result.error) failed++;
        else processed++;
      }
    };
    await Promise.all(
      Array.from({ length: source === "whop" ? 1 : 6 }, worker),
    );
    if (ghlContext && !failed)
      await syncBookings(ghlContext.contacts, ghlContext.fields);
    const status = failed ? "failed" : "succeeded";
    const save = await db
      .from("sync_runs")
      .update({
        status,
        completed_at: new Date().toISOString(),
        records_processed: processed,
        records_failed: failed,
        error: failed ? "Some records need identity or payload review" : null,
      })
      .eq("id", run.data.id);
    if (save.error) throw new Error("Could not persist sync result");
    return { status, processed, failed };
  } catch {
    await db
      .from("sync_runs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        records_processed: processed,
        records_failed: failed + 1,
        error: "Sync failed. Check account permissions and configuration.",
      })
      .eq("id", run.data.id);
    throw new Error(
      "Sync failed. Check account permissions and configuration.",
    );
  }
}
