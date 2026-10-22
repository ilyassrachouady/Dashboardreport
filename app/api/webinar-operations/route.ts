import { notionManaged } from "../../../lib/integrations/notion";
import { sameOrigin } from "../../../lib/same-origin";
import { NextResponse } from "next/server";
import { database, isDemo } from "../../../lib/db";
import { webinarOperationsSchema } from "../../../lib/webinar-operations";
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  if (isDemo()) return NextResponse.json({ error: "Session changes are disabled in demo mode." }, { status: 409 });
  const parsed = webinarOperationsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid session details" }, { status: 400 });
  try {
    const { id, ...fields } = parsed.data;
    const current = await database().from("webinars").select("*").eq("id",id).maybeSingle();
    if (current.error) throw new Error("Session lookup failed");
    if (current.data && notionManaged(current.data.external_id,current.data.notion_page_id)) return NextResponse.json({error:"Edit this session in Notion."},{status:409});
    const result = await database().from("webinars").update({ ...fields, operations_updated_at: new Date().toISOString() }).eq("id", id).select("id").maybeSingle();
    if (result.error) return NextResponse.json({ error: "Session setup is not enabled yet or could not be saved. Ask your workspace administrator to check setup." }, { status: 502 });
    if (!result.data) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    return NextResponse.json({ saved: true });
  } catch { return NextResponse.json({ error: "Session storage is unavailable." }, { status: 503 }); }
}
