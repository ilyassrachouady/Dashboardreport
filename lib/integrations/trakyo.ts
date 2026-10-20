import { createHash } from "node:crypto";
import { z } from "zod";
import { eventSchema } from "./schema";
const touch = z.object({type:z.string(), name:z.string(),source_name:z.string().nullable(),content_item:z.string().nullable(),occurred_at:z.string()}).nullable();
const lead = z.object({id:z.string(),created_at:z.string(),identifiers:z.object({emails:z.array(z.string()),phones:z.array(z.string()),names:z.array(z.string())}),first_touch:touch,last_touch:touch});
export function adaptTrakyoLead(raw:unknown) {
 const c=lead.parse(raw);
 const name=c.identifiers.names[0]?.trim().split(/\s+/) || [];
 const phone=c.identifiers.phones.find(p=>/^\+[1-9]\d{7,14}$/.test(p));
 const touches=(["first_touch","last_touch"] as const).flatMap(kind=>{
  const t=c[kind]; if(!t)return [];
  return [{external_touch_id:`${c.id}:${kind}:${createHash("sha256").update(JSON.stringify(t)).digest("hex")}`,touch_type:kind,source:t.source_name||t.type,medium:t.type,content:t.name,campaign:"",occurred_at:new Date(t.occurred_at).toISOString()}];
 });
 const payload={provider:"trakyo",event_id:"pending",contact:{trakyo_id:c.id,email:c.identifiers.emails[0]?.trim().toLowerCase()||undefined,phone,first_name:name[0]||"",last_name:name.slice(1).join(" "),created_at:new Date(c.created_at).toISOString()},touches};
 payload.event_id=`lead:${c.id}:${createHash("sha256").update(JSON.stringify(payload)).digest("hex")}`;
 return eventSchema.parse(payload);
}
export function adaptTrakyo(payload:unknown){const event=eventSchema.parse(payload);if(event.provider!=="trakyo")throw new Error("Provider mismatch");return event;}
export async function fetchTrakyoLeads(){
 if(!process.env.TRAKYO_API_KEY)throw new Error("Configure TRAKYO_API_KEY");
 const all:unknown[]=[]; let cursor:string|undefined; const seen=new Set<string>();
 for(let page=0;page<200;page++){
  const url=new URL("https://api.trakyo.io/v1/leads");url.searchParams.set("limit","500");if(cursor)url.searchParams.set("starting_after",cursor);
  const r=await fetch(url,{headers:{Authorization:`Bearer ${process.env.TRAKYO_API_KEY}`},signal:AbortSignal.timeout(30000)});
  if(!r.ok)throw new Error(`Trakyo leads read failed (${r.status}); check leads:read scope`);
  const b=z.object({data:z.array(z.unknown()),has_more:z.boolean(),next_cursor:z.string().nullable()}).parse(await r.json());
  all.push(...b.data);if(!b.has_more)return all;
  if(!b.next_cursor||seen.has(b.next_cursor))throw new Error("Invalid Trakyo pagination");seen.add(b.next_cursor);cursor=b.next_cursor;
 }
 throw new Error("Trakyo batch limit reached");
}
