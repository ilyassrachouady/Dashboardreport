import { sameOrigin } from "../../../lib/same-origin";
import { NextResponse } from "next/server";
import { database, isDemo } from "../../../lib/db";
import { attendanceImportSchema } from "../../../lib/webinar-attendance-import";
export const maxDuration = 60;
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  if (isDemo()) return NextResponse.json({ error: "Attendance imports are disabled in demo mode." }, { status: 409 });
  const parsed = attendanceImportSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid attendance" }, { status: 400 });
  try {
    const db = database(), input = parsed.data;
    const session = await db.from("webinars").select("id").eq("id", input.webinar_id).maybeSingle();
    if (session.error) throw new Error("Session lookup failed");
    if (!session.data) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    const contacts = new Map<string,string>();
    for (let start = 0; start < input.rows.length; start += 100) {
      const result = await db.from("contacts").select("id,email").in("email", input.rows.slice(start,start+100).map(r=>r.email));
      if (result.error) throw new Error("Contact lookup failed");
      for (const c of result.data) if (c.email) contacts.set(c.email.toLowerCase(), c.id);
    }
    const unmatched = input.rows.filter(r => !contacts.has(r.email)).map(r=>r.email);
    if (input.preview) return NextResponse.json({ matched: input.rows.length - unmatched.length, unmatched, total: input.rows.length });
    if (unmatched.length) return NextResponse.json({ error: "Some emails do not match imported CRM contacts. Fix these before importing; nothing has been saved.", unmatched }, { status: 422 });
    const rows = input.rows.map(({email,...evidence}) => ({ ...evidence, contact_id: contacts.get(email)! }));
    const result = await db.rpc("import_webinar_attendance", { session_id: input.webinar_id, evidence: rows });
    if (result.error) throw new Error("Attendance could not be saved. Ask your workspace administrator to check attendance setup.");
    return NextResponse.json({ saved: true, imported: rows.length });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Attendance import failed" }, { status: 502 }); }
}

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("webinar_id");
  if (isDemo()) return NextResponse.json({ rows: [], demo: true }, { headers: { "Cache-Control": "no-store" } });
  if (!attendanceImportSchema.shape.webinar_id.safeParse(id).success) return NextResponse.json({ error: "Invalid session" }, { status: 400 });
  try {
    const rows = [];
    for (let start=0;;start+=1000) {
      const result = await database().from("webinar_attendance").select("id,attended_live,attended_replay,evidence_source,updated_at,contacts(first_name,last_name,email)").eq("webinar_id", id).order("id").range(start,start+999);
      if (result.error) return NextResponse.json({ error: "Attendance import is not enabled yet. Ask your workspace administrator to finish setup." }, { status: 502 });
      rows.push(...result.data);
      if (result.data.length<1000) break;
    }
    return NextResponse.json({rows}, {headers:{"Cache-Control":"private, no-store"}});
  } catch { return NextResponse.json({ error: "Attendance storage is unavailable" }, {status:503}); }
}
