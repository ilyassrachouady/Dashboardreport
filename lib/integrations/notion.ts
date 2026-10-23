import "server-only";
import { z } from "zod";
import type { Webinar } from "../model";
const uuid = z.string().transform(v=>v.replaceAll("-","")).pipe(z.string().regex(/^[a-f0-9]{32}$/i));
export function notionSessionMap(webinars:Webinar[]=[]): Record<string,string> {
  const value = process.env.NOTION_SESSION_MAP_JSON;
  try {
    const mapping=z.record(z.string(),uuid).parse(JSON.parse(value||"{}"));
    for(const w of webinars)if(w.notion_page_id)mapping[w.external_id]=uuid.parse(w.notion_page_id);
    return mapping;
  }
  catch { throw new Error("Notion session mapping is invalid."); }
}
export function notionManaged(externalId:string, pageId?:string|null) { return Boolean(pageId || notionSessionMap()[externalId]); }
const pageSchema=z.object({id:z.string(),url:z.string(),last_edited_time:z.string(),parent:z.object({data_source_id:z.string().optional()}).passthrough(),properties:z.record(z.string(),z.any())});
type Page=z.infer<typeof pageSchema>;
export function notionSessionPatch(page: Page) {
 const number=(name:string)=>{const p=page.properties[name];if(!p||p.type!=="number")throw Error(`Notion is missing the ${name} number field.`);return z.number().int().min(0).max(10000000).nullable().parse(p.number);};
 const url=(name:string)=>{const p=page.properties[name];if(!p||p.type!=="url")throw Error(`Notion is missing the ${name} link field.`);if(p.url===null)return null;return z.url({protocol:/^https$/}).parse(p.url);};
 const peak=number("Attendees at Peak"),pitch=number("Attendees at Pitch");
 if(peak!==null&&pitch!==null&&pitch>peak)throw Error("Notion pitch attendance exceeds peak attendance.");
 const selected=page.properties.Audience?.multi_select?.map((v:{name:string})=>v.name)||[];
 const status=page.properties.Status?.status?.name;
 return {
  peak_attendees:peak,pitch_attendees:pitch,
  slides_url:url("Slides"),replay_url:url("Replay Link"),presenter_url:url("Link for Presenter"),
  notion_page_url:page.url,notion_managed:true,notion_updated_at:page.last_edited_time,notion_error:null,
  promotion_type: (selected.includes("Organic")&&selected.includes("Paid")?"mixed":selected.includes("Organic")?"organic":selected.includes("Paid")?"paid":"unknown") as Webinar["promotion_type"],
  event_status:(status==="Done"?"completed":status==="In progress"?"ready":status==="Not started"?"planned":"unknown") as Webinar["event_status"],
 };
}
async function request(path:string,body?:unknown,method=body?"POST":"GET") {
 if(!process.env.NOTION_API_KEY)throw Error("Notion API key is not configured.");
 const response=await fetch(`https://api.notion.com/v1/${path}`,{method,headers:{Authorization:`Bearer ${process.env.NOTION_API_KEY}`,"Notion-Version":"2025-09-03","Content-Type":"application/json"},...(body?{body:JSON.stringify(body)}:{}),cache:"no-store",signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error(`Notion read failed (${response.status}). Check access to Client Events.`);
 return response.json();
}
export async function notionWebinars(webinars:Webinar[]):Promise<Webinar[]> {
 const mapping=notionSessionMap(webinars);const managed=webinars.filter(w=>mapping[w.external_id]);if(!managed.length)return webinars;
 try {
  const databaseId=uuid.parse(process.env.NOTION_DATABASE_ID);
  const container=await request(`databases/${databaseId}`);
  const sources=z.array(z.object({id:z.string()})).parse(container.data_sources);
  if(sources.length!==1)throw Error("Choose a single Notion Client Events data source before syncing.");
  const pages:Page[]=[];let cursor:string|undefined;
  for(let i=0;i<100;i++){
   const response=await request(`data_sources/${sources[0].id}/query`,{page_size:100,...(cursor?{start_cursor:cursor}:{})});
   pages.push(...z.array(pageSchema).parse(response.results));
   if(!response.has_more){cursor=undefined;break;}
   const next=z.string().min(1).parse(response.next_cursor);if(next===cursor)throw Error("Notion pagination repeated a cursor.");cursor=next;
  }
  if(cursor)throw Error("Notion pagination limit reached.");
  return webinars.map(w=>{
   const pageId=mapping[w.external_id];if(!pageId)return w;
   const page=pages.find(p=>uuid.parse(p.id)===pageId);
   if(!page)throw Error("A mapped session was not found in the Notion test database.");
   return {...w,...notionSessionPatch(page)};
  });
 }catch(error){
  const message=error instanceof Error?error.message:"Notion refresh failed";
  return webinars.map(w=>mapping[w.external_id]?{...w,notion_managed:true,notion_error:message,peak_attendees:null,pitch_attendees:null}:w);
 }
}


// Automatic counts only. Moderator inputs and formula properties are never written.
export async function syncNotionCounts(counts: Record<string,{registrants?:number;bookings?:number}>, webinars:Webinar[] = []) {
 const mapping=notionSessionMap(webinars);
 const targets=Object.entries(counts).filter(([external])=>mapping[external]);
 if(!targets.length)return {updated:0};
 const db=await request(`databases/${uuid.parse(process.env.NOTION_DATABASE_ID)}`);
 const sources=z.array(z.object({id:uuid})).parse(db.data_sources);
 let updated=0;
 for(const [external,totals] of targets){
  const page=pageSchema.parse(await request(`pages/${mapping[external]}`));
  if(!page.parent.data_source_id || !sources.some(s=>s.id===uuid.parse(page.parent.data_source_id)))throw Error("Notion event belongs to a different database.");
  const properties:Record<string,{number:number}>={};
  for(const [key,name]of [["registrants","Registrants"],["bookings","Calls booked"]] as const){
   if(totals[key]===undefined)continue;
   const count=z.number().int().nonnegative().parse(totals[key]);
   if(page.properties[name]?.type!=="number")throw Error(`Notion ${name} must be a number field.`);
   if(page.properties[name].number!==count)properties[name]={number:count};
  }
  if(!Object.keys(properties).length)continue;
  await request(`pages/${mapping[external]}`,{properties},"PATCH");
  const verified=pageSchema.parse(await request(`pages/${mapping[external]}`));
  if(Object.entries(properties).some(([key,value])=>verified.properties[key]?.number!==value.number))throw Error("Notion count write could not be verified.");
  updated++;
 }
 return {updated};
}
export function syncNotionRegistrantCounts(counts: Record<string,number>, webinars:Webinar[] = []) {
 return syncNotionCounts(Object.fromEntries(Object.entries(counts).map(([id,registrants])=>[id,{registrants}])),webinars);
}


export async function notionEventChoices() {
 const db=await request(`databases/${uuid.parse(process.env.NOTION_DATABASE_ID)}`);
 const sources=z.array(z.object({id:z.string()})).parse(db.data_sources);
 if(sources.length!==1)throw Error("Choose one Client Events data source.");
 const pages:Page[]=[];let cursor:string|undefined;
 for(let i=0;i<100;i++){
  const r=await request(`data_sources/${sources[0].id}/query`,{page_size:100,...(cursor?{start_cursor:cursor}:{})});
  pages.push(...z.array(pageSchema).parse(r.results));
  if(!r.has_more)return pages.map(p=>({id:p.id,url:p.url,name:(p.properties.Name?.title||[]).map((t:{plain_text:string})=>t.plain_text).join("")||"Untitled event",date:p.properties.Date?.date?.start||null}));
  const next=z.string().parse(r.next_cursor);if(next===cursor)throw Error("Notion pagination repeated");cursor=next;
 }
 throw Error("Notion event list exceeded the safe page limit.");
}
