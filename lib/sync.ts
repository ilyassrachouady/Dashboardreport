import "server-only";
import { notionSessionMap, syncNotionRegistrantCounts } from "./integrations/notion";
import { fetchWhopHistory } from "./integrations/whop-history";
import { syncBookings } from "./sync-bookings";
import { syncWebinarCohorts } from "./sync-webinar-cohort";
import { sourceMappings } from "./source-normalization";
import { adaptTrakyoLead, fetchTrakyoLeads } from "./integrations/trakyo";
import {
  adaptWebinarRegistrant,
  fetchWebinarRegistrants,
  discoverWebinars,
  scheduledSessionRows,
  reconcileScheduledSession,
} from "./integrations/webinars";
import { database } from "./db";
import { assignMissingSessionCodes } from "./session-code";
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
      const ids=await discoverWebinars();
      for(const webinarId of ids){
        const {details,registrants}=await fetchWebinarRegistrants(webinarId);
        for(const row of scheduledSessionRows(details,registrants)){
          // Promote a zero-registration placeholder once its provider event ID
          // becomes known, preserving the session UUID and its Notion link.
          const prefix=row.external_id.split(":").slice(0,3).join(":")+":";
          const existing=await db.from("webinars").select("id,external_id,webinar_date").eq("provider","webinars").like("external_id",`${prefix}%`);
          if(existing.error)throw Error("Could not read scheduled sessions");
          const placeholderId=`${prefix}${details.schedules.find(s=>row.external_id.startsWith(`webinarjam:${details.webinar_id}:${s.schedule}:`))?.date}`;
          const identity=reconcileScheduledSession(row,existing.data,placeholderId);
          row.external_id=identity.externalId;
          if(identity.promoteId){
            const promoted=await db.from("webinars").update({external_id:row.external_id}).eq("id",identity.promoteId);
            if(promoted.error)throw Error("Could not reconcile the scheduled session");
          }
          const saved=await db.from("webinars").upsert(row,{onConflict:"provider,external_id"});
          if(saved.error)throw Error("Could not save discovered session");
        }
        for(const row of registrants){
          try{events.push(adaptWebinarRegistrant(row,details));}catch{failed++;}
        }
      }
      const coded = await db
        .from("webinars")
        .select("id,webinar_date,session_code,client_series,released_codes");
      if (coded.error) {
        if (!/session_code|client_series|released_codes/.test(coded.error.message))
          throw Error("Could not read session codes");
      } else {
        for (const next of assignMissingSessionCodes(coded.data || [])) {
          const write = await db
            .from("webinars")
            .update({ session_code: next.session_code, client_series: next.client_series })
            .eq("id", next.id)
            .is("session_code", null);
          if (write.error && !/session_code|client_series/.test(write.error.message))
            throw Error("Could not assign the session code");
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
    if (source === "webinars" && !failed) {
      const sessions=await db.from("webinars").select("*");
      if(sessions.error)throw new Error("Notion session lookup failed");
      const externalIds=Object.keys(notionSessionMap(sessions.data));
      if(externalIds.length){
        const totals:Record<string,number>={};
        for(const w of sessions.data.filter(w=>externalIds.includes(w.external_id))){
          const registrations=await db.from("webinar_registrations").select("id",{count:"exact",head:true}).eq("webinar_id",w.id);
          if(registrations.error||registrations.count===null)throw new Error("Registration count could not be verified");
          totals[w.external_id]=registrations.count;
        }
        await syncNotionRegistrantCounts(totals,sessions.data);
      }
    }
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
