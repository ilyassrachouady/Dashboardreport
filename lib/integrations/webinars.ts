import { createHash } from "node:crypto";
import { z } from "zod";
import { eventSchema } from "./schema";
// WebinarJam returns wall-clock timestamps in the webinar timezone, not UTC.
export function webinarTimestamp(value: string, timezone: string) {
  if (/(?:Z|[+-]\d{2}:\d{2})$/.test(value))
    return new Date(value).toISOString();
  const normalized = value.replace(/^\w{3},\s*/, "");
  const wall = new Date(`${normalized} UTC`);
  if (!Number.isFinite(+wall)) throw new Error("Invalid WebinarJam timestamp");
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  let utc = +wall;
  for (let i = 0; i < 3; i++) {
    const p = Object.fromEntries(
      fmt.formatToParts(new Date(utc)).map((p) => [p.type, p.value]),
    );
    const observed = Date.UTC(
      +p.year,
      +p.month - 1,
      +p.day,
      +p.hour,
      +p.minute,
      +p.second,
    );
    const correction = +wall - observed;
    if (!correction) break;
    utc += correction;
  }
  return new Date(utc).toISOString();
}
const webinar = z.object({
  webinar_id: z.union([z.string(), z.number()]),
  name: z.string(),
  timezone: z.string(),
  schedules: z.array(
    z.object({ date: z.string(), schedule: z.union([z.string(), z.number()]) }),
  ),
});
const registrant = z.object({
  id: z.union([z.string(), z.number()]),
  schedule_id: z.union([z.string(), z.number()]),
  event_id: z.union([z.string(), z.number()]).nullish(),
  email: z.string(),
  first_name: z.string().nullish(),
  last_name: z.string().nullish(),
  signup_date: z.string(),
  utm_source: z.unknown().optional(),
  utm_medium: z.unknown().optional(),
  utm_campaign: z.unknown().optional(),
  utm_content: z.unknown().optional(),
});
export function adaptWebinarRegistrant(raw: unknown, details: unknown) {
  const w = webinar.parse(details),
    r = registrant.parse(raw);
  const s = w.schedules.find(
    (s) => String(s.schedule) === String(r.schedule_id),
  );
  if (!s) throw new Error("Unmapped WebinarJam schedule");
  const id = `webinarjam:${w.webinar_id}:${s.schedule}:${r.event_id || s.date}`;
  const rawValue = (v: unknown) => (typeof v === "string" ? v : "");
  const payload = {
    provider: "webinars",
    event_id: "pending",
    contact: {
      email: r.email.trim().toLowerCase(),
      first_name: r.first_name || "",
      last_name: r.last_name || "",
    },
    webinars: [
      {
        external_id: id,
        name: w.name,
        webinar_date: webinarTimestamp(s.date, w.timezone),
        peak_attendees: null,
        pitch_attendees: null,
      },
    ],
    registrations: [
      {
        webinar_external_id: id,
        registered_at: webinarTimestamp(r.signup_date, w.timezone),
        raw_utm_source: rawValue(r.utm_source),
        raw_utm_medium: rawValue(r.utm_medium),
        raw_utm_campaign: rawValue(r.utm_campaign),
        raw_utm_content: rawValue(r.utm_content),
      },
    ],
  };
  payload.event_id = `registrant:${r.id}:${createHash("sha256").update(JSON.stringify(payload)).digest("hex")}`;
  return eventSchema.parse(payload);
}
export function adaptWebinars(payload: unknown) {
  const e = eventSchema.parse(payload);
  if (e.provider !== "webinars") throw new Error("Provider mismatch");
  return e;
}
async function request(path: string, params: Record<string, string> = {}) {
  if (!process.env.WEBINARJAM_API_KEY || !process.env.WEBINARJAM_WEBINAR_ID)
    throw new Error("Configure WebinarJam key and webinar ID");
  const r = await fetch(`https://api.webinarjam.com/webinarjam/${path}`, {
    method: "POST",
    body: new URLSearchParams({
      api_key: process.env.WEBINARJAM_API_KEY,
      webinar_id: process.env.WEBINARJAM_WEBINAR_ID,
      ...params,
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) throw new Error(`WebinarJam read failed (${r.status})`);
  const b = await r.json();
  if (b.status !== "success")
    throw new Error("WebinarJam rejected the read request");
  return b;
}
export function verifyRegistrantPages(rows: unknown[], total: number) {
  if (rows.length !== total)
    throw new Error(
      "Incomplete WebinarJam import: row count differs from API total",
    );
  const ids = rows.map((row) => registrant.parse(row).id).map(String);
  if (new Set(ids).size !== ids.length)
    throw new Error("Duplicate WebinarJam registration IDs across pages");
}
export async function fetchWebinarRegistrants() {
  const details = webinar.parse((await request("webinar")).webinar);
  const all: unknown[] = [];
  let expectedTotal: number | undefined;
  for (let page = 1; page <= 1000; page++) {
    const b = await request("registrants", {
      page: String(page),
      date_range: "0",
      attended_live: "0",
      attended_replay: "0",
      purchased: "0",
    });
    const batch = z
      .object({
        data: z.array(z.unknown()),
        current_page: z.number(),
        last_page: z.number(),
        total: z.union([z.number(), z.string().regex(/^\d+$/)]).transform(Number).pipe(z.number().int().nonnegative()),
      })
      .parse(b.registrants);
    if (batch.current_page !== page)
      throw new Error("WebinarJam returned the wrong pagination page");
    if (expectedTotal !== undefined && expectedTotal !== batch.total)
      throw new Error(
        "WebinarJam registrations changed during import; retry the sync",
      );
    expectedTotal = batch.total;
    all.push(...batch.data);
    if (batch.current_page >= batch.last_page) {
      verifyRegistrantPages(all, batch.total);
      return { details, registrants: all, providerTotal: batch.total };
    }
  }
  throw new Error("WebinarJam batch limit reached");
}
