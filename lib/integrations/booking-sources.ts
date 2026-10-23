import "server-only";
import { bookingEvidence, type BookingEvidence, type BookingSourceRule, type BookingSource } from "../booking-source";
import type { Webinar } from "../model";
async function read(path: string) {
  const response = await fetch(`https://api.trakyo.io${path}`, {
    headers: { Authorization: `Bearer ${process.env.TRAKYO_API_KEY}` },
    cache: "no-store", signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`Trakyo booking evidence unavailable (${response.status})`);
  return response.json();
}
export async function fetchBookingSources(sessions: Webinar[]) {
  const configured = sessions.flatMap(w => ([
    [w.live_booking_url, "live"], [w.replay_booking_url, "replay"], [w.followup_booking_url, "followup"], [w.whatsapp_booking_url, "followup"],
  ] as const).filter((r): r is readonly [string, BookingSource] => Boolean(r[0])).map(([url, source]) => ({ webinarId: w.id, url, source })));
  if (!configured.length) return { rules: [] as BookingSourceRule[], evidence: [] as BookingEvidence[] };
  if (!process.env.TRAKYO_API_KEY) throw new Error("Trakyo is required for configured booking-source links");
  const rules: BookingSourceRule[] = [];
  const matchedUrls=new Set<string>();
  let cursor = "";
  for (let page = 0; ; page++) {
    if (page >= 100) throw new Error("Trakyo link pagination limit reached");
    const body = await read(`/v1/links?limit=100${cursor ? `&starting_after=${encodeURIComponent(cursor)}` : ""}`);
    if (!Array.isArray(body.data) || typeof body.has_more !== "boolean") throw new Error("Invalid Trakyo link page");
    for (const link of body.data) for (const config of configured) {
      if (link.short_link === config.url && typeof link.content_item_id === "string") { matchedUrls.add(config.url); rules.push({ webinarId: config.webinarId, source: config.source, contentId: link.content_item_id }); }
    }
    if (!body.has_more) break;
    const last = body.data.at(-1); const next = last ? `${last.domain_id}:${last.key}` : "";
    if (!next || next === cursor) throw new Error("Invalid Trakyo link cursor"); cursor = next;
  }
  if (configured.some(c => !matchedUrls.has(c.url))) throw new Error("A configured booking link is not a readable Trakyo short link");
  const evidence: BookingEvidence[] = []; cursor = "";
  const seen = new Set<string>();
  for (let page = 0; ; page++) {
    if (page >= 100) throw new Error("Trakyo booking-lead pagination limit reached");
    const body = await read(`/v1/leads?has_booking=true&limit=500${cursor ? `&starting_after=${encodeURIComponent(cursor)}` : ""}`);
    if (!Array.isArray(body.data) || typeof body.has_more !== "boolean") throw new Error("Invalid Trakyo booking-lead page");
    for (const lead of body.data) {
      if (typeof lead.id !== "string" || !lead.id.startsWith("lead_")) throw new Error("Invalid Trakyo lead identity");
      const events = await read(`/v1/leads/${encodeURIComponent(lead.id)}/events`);
      if (!Array.isArray(events.data) || events.has_more !== false) throw new Error("Trakyo journey incomplete; booking attribution needs review");
      for (const raw of events.data) { const e = bookingEvidence(raw); if (e) evidence.push(e); }
    }
    if (!body.has_more) break;
    if (!body.next_cursor || seen.has(body.next_cursor)) throw new Error("Invalid Trakyo booking-lead cursor");
    cursor = body.next_cursor; seen.add(cursor);
  }
  return { rules, evidence };
}
