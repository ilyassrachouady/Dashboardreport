import { NextResponse } from "next/server";
import { z } from "zod";
import { isDemo } from "../../../lib/db";
import {
  fetchGhlContacts,
  fetchGhlFieldMap,
} from "../../../lib/integrations/ghl";
import { syncWebinarCohorts } from "../../../lib/sync-webinar-cohort";
import { syncBookings } from "../../../lib/sync-bookings";
export const maxDuration = 300;
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  if (isDemo())
    return NextResponse.json(
      { error: "Demo mode does not sync CRM counts" },
      { status: 409 },
    );
  const parsed = z
    .object({ id: z.uuid() })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid session" }, { status: 400 });
  try {
    const [contacts, fields] = await Promise.all([
      fetchGhlContacts(),
      fetchGhlFieldMap(),
    ]);
    const result = await syncWebinarCohorts(contacts, fields, parsed.data.id);
    const bookings = await syncBookings(contacts, fields);
    return NextResponse.json({ result, bookings });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "CRM cohort sync failed" },
      { status: 502 },
    );
  }
}
