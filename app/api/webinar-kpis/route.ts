import { notionManaged } from "../../../lib/integrations/notion";
import { NextResponse } from "next/server";
import { z } from "zod";
import { webinarTagMap } from "../../../lib/integrations/ghl-webinar";
import { database, isDemo } from "../../../lib/db";
const count = z.number().int().nonnegative().max(10000000).nullable();
const schema = z
  .object({
    id: z.uuid(),
    peak_attendees: count,
    pitch_attendees: count,
    application_count: count,
    call_booked_count: count,
    applicant_booked_count: count,
  })
  .superRefine((v, ctx) => {
    if (
      v.peak_attendees !== null &&
      v.pitch_attendees !== null &&
      v.pitch_attendees > v.peak_attendees
    )
      ctx.addIssue({
        code: "custom",
        message: "People at pitch cannot exceed peak attendees.",
      });
    if (
      v.applicant_booked_count !== null &&
      ((v.application_count !== null &&
        v.applicant_booked_count > v.application_count) ||
        (v.call_booked_count !== null &&
          v.applicant_booked_count > v.call_booked_count))
    )
      ctx.addIssue({
        code: "custom",
        message:
          "Booked applicants cannot exceed applicants or total booked calls.",
      });
  });
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  if (isDemo())
    return NextResponse.json(
      { error: "Switch to live data to save webinar counts." },
      { status: 409 },
    );
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid webinar counts" },
      { status: 400 },
    );
  const { id, ...counts } = parsed.data;
  const current = await database()
    .from("webinars")
    .select(
      "*",
    )
    .eq("id", id)
    .single();
  if (current.error)
    return NextResponse.json(
      { error: "Unknown webinar session" },
      { status: 404 },
    );
  if (notionManaged(current.data.external_id,current.data.notion_page_id)) {
    delete (counts as Partial<typeof counts>).peak_attendees;
    delete (counts as Partial<typeof counts>).pitch_attendees;
  }
  // CRM-managed applicants must not be overwritten by a stale manual form.
  if (webinarTagMap([current.data])[current.data.external_id])
    counts.application_count = current.data.application_count;
  const bookingSync = await database()
    .from("sync_runs")
    .select("id")
    .eq("source", "ghl_bookings")
    .eq("status", "succeeded")
    .limit(1);
  if (bookingSync.error)
    return NextResponse.json(
      { error: "Cannot verify booking sync status" },
      { status: 502 },
    );
  if (webinarTagMap([current.data])[current.data.external_id] && bookingSync.data.length) {
    counts.call_booked_count = current.data.call_booked_count;
    counts.applicant_booked_count = current.data.applicant_booked_count;
  }
  const r = await database()
    .from("webinars")
    .update({ ...counts, kpi_updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id")
    .single();
  if (r.error)
    return NextResponse.json(
      {
        error:
          "Could not save. Apply supabase/002_webinar_kpis.sql in Supabase first.",
      },
      { status: 502 },
    );
  return NextResponse.json({ saved: true });
}
