import { NextResponse } from "next/server";
import { z } from "zod";
import { database, isDemo } from "../../../lib/db";
import { sameOrigin } from "../../../lib/same-origin";
import { changeClientSeries, clientSeries } from "../../../lib/session-code";
const schema = z.object({ id: z.uuid(), client_series: z.enum(clientSeries) }).strict();
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  if (isDemo()) return NextResponse.json({ error: "Session codes cannot be changed in demo mode." }, { status: 409 });
  const input = schema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "Choose a client series." }, { status: 400 });
  try {
    const db = database();
    const sessions = await db.from("webinars").select("*");
    if (sessions.error) throw new Error("Session lookup failed.");
    const next = changeClientSeries(sessions.data, input.data.id, input.data.client_series);
    const saved = await db
      .from("webinars")
      .update({
        client_series: next.client_series,
        session_code: next.session_code,
        released_codes: next.released_codes,
      })
      .eq("id", input.data.id)
      .select("session_code")
      .single();
    if (saved.error)
      throw new Error(
        /session_code|client_series|released_codes/.test(saved.error.message)
          ? "Session codes are not installed. Apply supabase/005_session_codes.sql."
          : "Session code could not be saved.",
      );
    return NextResponse.json({ session_code: saved.data.session_code });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Session code failed." },
      { status: 502 },
    );
  }
}
