import { z } from "zod";
import { sameOrigin } from "../../../lib/same-origin";
import { database, isDemo } from "../../../lib/db";
const link = z.string().trim().max(2048).refine(v => { if (!v) return true; try { const u = new URL(v); return u.protocol === "https:" && !u.username && !u.password && !u.search && !u.hash; } catch { return false; } }, "Use the exact HTTPS Trakyo short link without query parameters.").transform(v => v || null);
const schema = z.object({id:z.uuid(),live_booking_url:link,replay_booking_url:link,followup_booking_url:link,whatsapp_booking_url:link}).strict();
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({error:"Invalid origin"},{status:403});
  if (isDemo()) return Response.json({error:"Changes are disabled in demo mode."},{status:409});
  const parsed = schema.safeParse(await request.json().catch(()=>null));
  if (!parsed.success) return Response.json({error:parsed.error.issues[0]?.message || "Invalid booking links"},{status:400});
  const {id,...fields} = parsed.data;
  const urls = Object.values(fields).filter(Boolean);
  if (new Set(urls).size !== urls.length) return Response.json({error:"Use a different tracked link for each placement."},{status:400});
  try {
    const otherSessions = await database().from("webinars")
      .select("id,live_booking_url,replay_booking_url,followup_booking_url,whatsapp_booking_url").neq("id",id);
    if (otherSessions.error) return Response.json({error:"Could not verify session link ownership. Check migration 006."},{status:503});
    if (otherSessions.data.some(session => [session.live_booking_url,session.replay_booking_url,session.followup_booking_url,session.whatsapp_booking_url].some(url => url && urls.includes(url))))
      return Response.json({error:"This tracked link already belongs to another webinar. Create a separate Trakyo link and content item for this session."},{status:409});
    const result = await database().from("webinars").update(fields).eq("id",id).select("id").maybeSingle();
    if (result.error) return Response.json({error:"Booking links could not be saved. Check that migration 006 has been applied."},{status:503});
    if (!result.data) return Response.json({error:"Session not found"},{status:404});
    return Response.json({saved:true});
  } catch { return Response.json({error:"Session storage unavailable"},{status:503}); }
}
