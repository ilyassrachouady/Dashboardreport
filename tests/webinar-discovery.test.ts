import test from "node:test";
import assert from "node:assert/strict";
import { scheduledSessionRows,reconcileScheduledSession,discoverWebinars,fetchWebinarRegistrants } from "../lib/integrations/webinars";
import { webinarTagMap } from "../lib/integrations/ghl-webinar";
const details={webinar_id:5,name:"Next webinar",timezone:"America/New_York",schedules:[{date:"2026-10-24 20:00",schedule:2}]};
const registrant={id:1,schedule_id:2,event_id:3,email:"person@example.com",signup_date:"2026-10-22 10:00"};
test("zero-registration sessions are discoverable and first registrations promote the same session",()=>{
 const empty=scheduledSessionRows(details,[])[0],known=scheduledSessionRows(details,[registrant])[0];
 assert.equal(empty.webinar_date,"2026-10-25T00:00:00.000Z");
 const promoted=reconcileScheduledSession(known,[{id:"same-session",...empty}],empty.external_id);
 assert.equal(promoted.promoteId,"same-session");assert.equal(promoted.externalId,"webinarjam:5:2:3");
 assert.equal(reconcileScheduledSession(empty,[{id:"same-session",...known}],empty.external_id).externalId,known.external_id);
});
test("reused provider event IDs cannot silently rewrite historical session dates",()=>{
 const w=scheduledSessionRows(details,[registrant])[0];
 assert.throws(()=>reconcileScheduledSession({...w,webinar_date:"2026-10-30T00:00:00Z"},[{id:"old",...w}],"placeholder"),/historical reports were preserved/);
 assert.throws(()=>scheduledSessionRows(details,[registrant,{...registrant,id:2,event_id:4}]),/multiple occurrences/);
});
test("distinct webinar IDs and schedules cannot share registration cohorts",()=>{
 const a=scheduledSessionRows(details,[registrant])[0];const b=scheduledSessionRows({...details,webinar_id:6},[{...registrant,id:2}])[0];
 assert.notEqual(a.external_id,b.external_id);
 assert.equal(webinarTagMap([{external_id:a.external_id,ghl_cohort_tag:"24-october"}])[a.external_id],"24-october");
});
test("account discovery finds new scheduled webinars and each registrant request uses its own webinar ID",async()=>{
 const old=globalThis.fetch,env={...process.env};Object.assign(process.env,{WEBINARJAM_API_KEY:"test"});delete process.env.WEBINARJAM_WEBINAR_ID;
 const seen:string[]=[];
 globalThis.fetch=async(url,options)=>{
 const body=new URLSearchParams(String(options?.body));
 if(String(url).endsWith('/webinars'))return Response.json({status:"success",webinars:[{webinar_id:5,type:"Single presentation"},{webinar_id:6,type:"Single presentation"},{webinar_id:1,type:"Right Now"}]});
 seen.push(body.get('webinar_id')!);
 if(String(url).endsWith('/webinar'))return Response.json({status:"success",webinar:{...details,webinar_id:body.get('webinar_id')}});
 return Response.json({status:"success",registrants:{data:[],current_page:1,last_page:1,total:0}});
 };
 try{assert.deepEqual(await discoverWebinars(),["5","6"]);await fetchWebinarRegistrants("5");await fetchWebinarRegistrants("6");assert.deepEqual(seen,["5","5","6","6"]);}
 finally{globalThis.fetch=old;process.env=env;}
});

test("connection storage can be installed twice and prevents sharing one Notion event between sessions",async()=>{
 const {PGlite}=await import("@electric-sql/pglite"),{readFile}=await import("node:fs/promises");const db=new PGlite();
 try{
 await db.exec("create schema revenue_intelligence;create table revenue_intelligence.webinars(id integer primary key);");
 const sql=await readFile(new URL("../supabase/004_webinar_connections.sql",import.meta.url),"utf8");await db.exec(sql);await db.exec(sql);
 await db.query("insert into revenue_intelligence.webinars(id,notion_page_id,ghl_cohort_tag) values(1,$1,$2)",["00000000-0000-4000-8000-000000000001","first-session"]);
 await assert.rejects(db.query("insert into revenue_intelligence.webinars(id,notion_page_id) values(2,$1)",["00000000-0000-4000-8000-000000000001"]));
 await assert.rejects(db.query("insert into revenue_intelligence.webinars(id,ghl_cohort_tag) values(2,$1)",["first-session"]));
 }finally{await db.close();}
});

test("legacy rows carrying an upcoming event ID cannot move the old schedule into the new session",async()=>{
 const {adaptWebinarRegistrant}=await import('../lib/integrations/webinars');
 const d={webinar_id:2,name:'Masterclass',timezone:'America/New_York',schedules:[{schedule:2,date:'2026-10-14 20:00'},{schedule:5,date:'2026-10-28 19:00'}]};
 const old={...registrant,schedule_id:2,event_id:2,event:'Wed, 14 Oct 2026, 08:00 PM'};
 const mixed={...old,id:2,event_id:5,event:'Wed, 28 Oct 2026, 07:00 PM'};
 const next={...mixed,id:3,schedule_id:5};
 const sessions=scheduledSessionRows(d,[old,mixed,next]);
 assert.equal(sessions[0].external_id,'webinarjam:2:2:2');assert.equal(sessions[1].external_id,'webinarjam:2:5:5');
 const payload=adaptWebinarRegistrant(mixed,d,sessions[0].external_id);
 assert.equal(payload.registrations?.[0].webinar_external_id,'webinarjam:2:2:2');
});
