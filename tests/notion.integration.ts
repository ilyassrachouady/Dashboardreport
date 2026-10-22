import test from "node:test";
import assert from "node:assert/strict";
import { notionWebinars, syncNotionRegistrantCounts } from "../lib/integrations/notion";
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
