import test from "node:test";
import assert from "node:assert/strict";
import { notionWebinars, syncNotionRegistrantCounts, syncNotionCounts } from "../lib/integrations/notion";
const dbid="00000000000040008000000000000001", source="00000000-0000-4000-8000-000000000002",pageid="00000000-0000-4000-8000-000000000003";
function page(peak:number|null=72,pitch:number|null=62){return {id:pageid,url:`https://www.notion.so/${pageid}`,last_edited_time:"2026-10-22T12:00:00Z",parent:{data_source_id:source},properties:{"Attendees at Peak":{type:"number",number:peak},"Attendees at Pitch":{type:"number",number:pitch},Slides:{type:"url",url:null},"Replay Link":{type:"url",url:"https://example.com/replay"},"Link for Presenter":{type:"url",url:null},Registrants:{type:"number",number:272},Audience:{multi_select:[{name:"Organic"}]},Status:{status:{name:"Done"}}}};}
test("Notion is the sole manual-input source; refreshes read changes and blank counts remain unknown",async()=>{
 const old=globalThis.fetch, env={...process.env};let current=page();
 Object.assign(process.env,{NOTION_API_KEY:"test",NOTION_DATABASE_ID:dbid,NOTION_SESSION_MAP_JSON:JSON.stringify({session:pageid})});
 globalThis.fetch=async(url,options)=>{assert.equal(options?.cache,"no-store");assert.notEqual(options?.method,"PATCH");return Response.json(String(url).includes('/query')?{results:[current],has_more:false}:{data_sources:[{id:source}]});};
 try{
 const w={id:"w",external_id:"session",name:"Canonical API name",webinar_date:"2026-10-15T00:00:00Z",peak_attendees:99,pitch_attendees:88,application_count:12,call_booked_count:10};
 const first=(await notionWebinars([w]))[0];assert.equal(first.peak_attendees,72);assert.equal(first.pitch_attendees,62);assert.equal(first.application_count,12);assert.equal(first.call_booked_count,10);assert.equal(first.notion_managed,true);
 current=page(70,60);assert.equal((await notionWebinars([w]))[0].pitch_attendees,60);
 current=page(null,null);assert.equal((await notionWebinars([w]))[0].peak_attendees,null);
 current=page(10,20);const invalid=(await notionWebinars([w]))[0];assert.equal(invalid.peak_attendees,null);assert.match(invalid.notion_error!,/exceeds/);
 }finally{globalThis.fetch=old;process.env=env;}
});
test("automatic registration sync writes only Registrants and skips unchanged values",async()=>{
 const old=globalThis.fetch,env={...process.env};let current=page(),writes=0;
 Object.assign(process.env,{NOTION_API_KEY:"test",NOTION_DATABASE_ID:dbid,NOTION_SESSION_MAP_JSON:JSON.stringify({session:pageid})});
 globalThis.fetch=async(url,options)=>{
 if(options?.method==="PATCH") {writes++;assert.deepEqual(JSON.parse(String(options.body)),{properties:{Registrants:{number:274}}});current.properties.Registrants.number=274;return Response.json(current);}
 return Response.json(String(url).includes('/databases/')?{data_sources:[{id:source}]}:current);
 };
 try{assert.equal((await syncNotionRegistrantCounts({session:274})).updated,1);assert.equal((await syncNotionRegistrantCounts({session:274})).updated,0);assert.equal(writes,1);assert.equal(current.properties['Attendees at Peak'].number,72);}
 finally{globalThis.fetch=old;process.env=env;}
});

test("saved session connections work without editing environment maps",async()=>{
 const old=globalThis.fetch,env={...process.env};Object.assign(process.env,{NOTION_API_KEY:"test",NOTION_DATABASE_ID:dbid,NOTION_SESSION_MAP_JSON:"{}"});
 globalThis.fetch=async(url)=>Response.json(String(url).includes('/query')?{results:[page()],has_more:false}:{data_sources:[{id:source}]});
 try{const w={id:"future",external_id:"webinarjam:99:1:1",name:"Future webinar",webinar_date:"2026-10-24T20:00:00Z",peak_attendees:null,pitch_attendees:null,notion_page_id:pageid};const result=(await notionWebinars([w]))[0];assert.equal(result.peak_attendees,72);assert.equal(result.notion_managed,true);}
 finally{globalThis.fetch=old;process.env=env;}
});

test("booking write-back changes only Calls booked, verifies it, and skips repeat writes",async()=>{
 const old=globalThis.fetch,env={...process.env};const current={...page(),properties:{...page().properties,"Calls booked":{type:"number",number:0}}};let writes=0;
 Object.assign(process.env,{NOTION_API_KEY:"test",NOTION_DATABASE_ID:dbid,NOTION_SESSION_MAP_JSON:JSON.stringify({session:pageid})});
 globalThis.fetch=async(url,options)=>{
  if(options?.method==="PATCH"){writes++;assert.deepEqual(JSON.parse(String(options.body)),{properties:{"Calls booked":{number:25}}});current.properties["Calls booked"].number=25;return Response.json(current);}
  return Response.json(String(url).includes('/databases/')?{data_sources:[{id:source}]}:current);
 };
 try{assert.equal((await syncNotionCounts({session:{bookings:25}})).updated,1);assert.equal((await syncNotionCounts({session:{bookings:25}})).updated,0);assert.equal(writes,1);assert.equal(current.properties['Attendees at Peak'].number,72);}
 finally{globalThis.fetch=old;process.env=env;}
});

test("actual session end comes only from a timestamped Notion Date range",async()=>{
 const {notionSessionPatch}=await import("../lib/integrations/notion");
 const base=page();
 const withEnd=(end:string|null)=>({...base,properties:{...base.properties,Date:{type:"date",date:{start:"2026-10-14T20:00:00-04:00",end}}}});
 assert.equal(notionSessionPatch(withEnd("2026-10-14T22:00:00-04:00")).webinar_ended_at,"2026-10-15T02:00:00.000Z");
 assert.equal(notionSessionPatch(withEnd("2026-10-15")).webinar_ended_at,null);
 assert.equal(notionSessionPatch(withEnd(null)).webinar_ended_at,null);
});

test("Start Date and separate End Time override legacy Date range and reject invalid ordering",async()=>{
 const {notionSessionPatch}=await import("../lib/integrations/notion");
 const current={...page(),properties:{...page().properties,"Start Date":{type:"date",date:{start:"2026-10-14T20:00:00-04:00"}},"End Time":{type:"date",date:{start:"2026-10-14T22:00:00-04:00"}},Date:{type:"date",date:{start:"2026-01-01T00:00:00Z",end:"2026-01-02T00:00:00Z"}}}};
 const p=notionSessionPatch(current);assert.equal(p.webinar_date,"2026-10-15T00:00:00.000Z");assert.equal(p.webinar_ended_at,"2026-10-15T02:00:00.000Z");
 current.properties['End Time'].date.start="2026-10-14T19:00:00-04:00";
 assert.throws(()=>notionSessionPatch(current),/later/);
 assert.throws(()=>notionSessionPatch({...current,properties:{...current.properties,"End Time":{type:"formula",formula:{type:"string",string:"date120"}}}}),/return a date/);
});

test("End Time dateAdd formula is read as a timestamp, including day rollover",async()=>{
 const {notionSessionPatch}=await import("../lib/integrations/notion");
 const current={...page(),properties:{...page().properties,"Start Date":{type:"date",date:{start:"2026-10-14T23:00:00-04:00"}},"End Time":{type:"formula",formula:{type:"date",date:{start:"2026-10-15T01:00:00-04:00",end:null}}}}};
 const p=notionSessionPatch(current);assert.equal(Date.parse(p.webinar_ended_at!)-Date.parse(p.webinar_date!),2*60*60*1000);
});
