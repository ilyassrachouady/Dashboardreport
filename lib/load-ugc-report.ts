import "server-only";
import { z } from "zod";
import { buildUgcReport } from "./ugc-report";
import { fetchWebinarRegistrants } from "./integrations/webinars";
import {
  notionClientEvents,
  syncNotionRegistrantCounts,
} from "./integrations/notion";

function config() {
  const apiKey = process.env.UGC_GHL_API_KEY,
    locationId = process.env.UGC_GHL_LOCATION_ID,
    webinarKey = process.env.UGC_WEBINARJAM_API_KEY,
    webinarId = process.env.UGC_WEBINARJAM_WEBINAR_ID,
    notionId = process.env.UGC_NOTION_PAGE_ID,
    notionClientId = process.env.UGC_NOTION_CLIENT_ID;
  if (
    !apiKey ||
    !locationId ||
    !webinarKey ||
    !webinarId ||
    !notionId ||
    !notionClientId
  )
    throw Error("UGC reporting connections are not configured.");
  if (
    locationId === process.env.GHL_LOCATION_ID ||
    webinarKey === process.env.WEBINARJAM_API_KEY
  )
    throw Error("UGC reporting must use separate CRM and WebinarJam accounts.");
  return {
    apiKey,
    locationId,
    webinarKey,
    webinarId,
    notionId,
    notionClientId,
  };
}
export async function loadUgcReport(syncNotion = false) {
  const cfg = config();
  async function ghl(path: string, body?: unknown) {
    const r = await fetch("https://services.leadconnectorhq.com" + path, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        Version: "2021-07-28",
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) throw Error(`UGC CRM read failed (${r.status}).`);
    return r.json();
  }
  async function contacts() {
    const all: unknown[] = [];
    const seen = new Set<string>();
    let cursor: unknown[] | undefined;
    for (let i = 0; i < 100; i++) {
      const b = await ghl("/contacts/search", {
        locationId: cfg.locationId,
        pageLimit: 100,
        ...(cursor ? { searchAfter: cursor } : {}),
      });
      const rows = z.array(z.record(z.string(), z.unknown())).parse(b.contacts);
      all.push(...rows);
      if (rows.length < 100) return all;
      const next = z.array(z.unknown()).min(1).parse(rows.at(-1)?.searchAfter);
      const key = JSON.stringify(next);
      if (seen.has(key)) throw Error("UGC CRM pagination repeated.");
      seen.add(key);
      cursor = next;
    }
    throw Error("UGC CRM import exceeds the page limit.");
  }
  const [crm, fields, events, provider] = await Promise.all([
    contacts(),
    ghl(
      `/locations/${encodeURIComponent(cfg.locationId)}/customFields?model=contact`,
    ),
    notionClientEvents(cfg.notionId, cfg.notionClientId),
    fetchWebinarRegistrants(cfg.webinarId, cfg.webinarKey),
  ]);
  const report = buildUgcReport({
    locationId: cfg.locationId,
    contacts: crm,
    fields: z
      .array(z.object({ id: z.string(), fieldKey: z.string() }))
      .parse(fields.customFields),
    events,
    providers: [provider],
    testEmails: process.env.UGC_TEST_EMAILS?.split(","),
  });
  if (syncNotion) {
    const webinars = report.sessions.map((s) => ({
      id: s.id,
      external_id: s.id,
      name: s.name,
      webinar_date: s.startsAt,
      peak_attendees: s.peak,
      pitch_attendees: s.pitch,
      notion_page_id: events.find(
        (e) => Date.parse(e.webinar_date) === Date.parse(s.startsAt),
      )!.pageId,
    }));
    await syncNotionRegistrantCounts(
      Object.fromEntries(report.sessions.map((s) => [s.id, s.registrants])),
      webinars,
    );
  }
  return report;
}
