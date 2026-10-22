import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { webinarOperationsSchema, bookingTiming } from "../lib/webinar-operations";
import { parseAttendanceCsv, attendanceImportSchema } from "../lib/webinar-attendance-import";
const id="00000000-0000-4000-8000-000000000001";
test("session setup validates URLs without changing manual KPI counts",()=>{
  const input={id,event_status:"completed",promotion_type:"mixed",presenter_url:"https://example.com/presenter",slides_url:"",replay_url:"",notion_page_url:"",live_booking_url:"",replay_booking_url:"",followup_booking_url:""};
  assert.equal(webinarOperationsSchema.parse(input).slides_url,null);
  for(const presenter_url of ["javascript:alert(1)","http://example.com","file:///tmp/a"])
    assert.equal(webinarOperationsSchema.safeParse({...input,presenter_url}).success,false);
  assert.equal(webinarOperationsSchema.safeParse({...input,peak_attendees:99}).success,false);
});
test("booking timing uses creation time and requires verified start/end evidence",()=>{
  assert.equal(bookingTiming("2026-10-22T18:00:00Z","2026-10-22T19:00:00Z","2026-10-22T21:00:00Z"),"before");
  assert.equal(bookingTiming("2026-10-22T20:00:00Z","2026-10-22T19:00:00Z","2026-10-22T21:00:00Z"),"during");
  assert.equal(bookingTiming("2026-10-23T20:00:00Z","2026-10-22T19:00:00Z","2026-10-22T21:00:00Z"),"after");
  assert.equal(bookingTiming("2026-10-22T20:00:00Z","2026-10-22T19:00:00Z",null),"unknown");
});
test("attendance imports preserve unknown, reject duplicate people and do not turn registrants into attendees",()=>{
  const rows=parseAttendanceCsv('\uFEFFemail,attended_live,attended_replay\r\n"PERSON@example.com",true,\r\nsecond@example.com,false,true\r\n');
  assert.deepEqual(rows[0],{email:"person@example.com",attended_live:true,attended_replay:null});
  assert.equal(attendanceImportSchema.safeParse({webinar_id:id,rows}).success,true);
  assert.equal(attendanceImportSchema.safeParse({webinar_id:id,rows:[rows[0],rows[0]]}).success,false);
  assert.equal(attendanceImportSchema.safeParse({webinar_id:id,rows:[{email:"a@example.com",attended_live:null,attended_replay:null}]}).success,false);
  assert.throws(()=>parseAttendanceCsv("email,attended_live,attended_replay\na@example.com,registered,"));
  assert.throws(()=>parseAttendanceCsv('email,attended_live,attended_replay\n"bad,true,'));
});
test("attendance migration is rerunnable, isolates sessions and imports atomically without duplicate people",async()=>{
 const db=new PGlite();try{
 await db.exec("create role anon;create role authenticated;create role service_role;create schema revenue_intelligence;create table revenue_intelligence.webinars(id uuid primary key);create table revenue_intelligence.contacts(id uuid primary key);");
 const sql=await readFile(new URL("../supabase/003_webinar_operations.sql",import.meta.url),"utf8");await db.exec(sql);await db.exec(sql);
 const second="00000000-0000-4000-8000-000000000002",person="00000000-0000-4000-8000-000000000003";
 await db.query("insert into revenue_intelligence.webinars values ($1),($2)",[id,second]);await db.query("insert into revenue_intelligence.contacts values ($1)",[person]);
 const save=(session:string,live:boolean|null,replay:boolean|null)=>db.query("select revenue_intelligence.import_webinar_attendance($1,$2::jsonb)",[session,JSON.stringify([{contact_id:person,attended_live:live,attended_replay:replay}])]);
 await save(id,true,null);await save(id,true,null);await save(id,null,true);await save(second,false,null);
 const rows=await db.query<{webinar_id:string;attended_live:boolean;attended_replay:boolean|null}>("select webinar_id,attended_live,attended_replay from revenue_intelligence.webinar_attendance order by webinar_id");
 assert.equal(rows.rows.length,2);assert.equal(rows.rows[0].attended_live,true);assert.equal(rows.rows[0].attended_replay,true);assert.equal(rows.rows[1].attended_live,false);assert.equal(rows.rows[1].attended_replay,null);
 const permission=await db.query<{allowed:boolean}>("select has_function_privilege('anon','revenue_intelligence.import_webinar_attendance(uuid,jsonb)','execute') as allowed");assert.equal(permission.rows[0].allowed,false);
 }finally{await db.close();}
});


test("same-origin guard respects the browser-facing host without accepting cross-site requests", async()=>{
 const {sameOrigin}=await import("../lib/same-origin");
 assert.equal(sameOrigin(new Request("http://localhost:3101/api/test",{headers:{host:"127.0.0.1:3101",origin:"http://127.0.0.1:3101"}})),true);
 assert.equal(sameOrigin(new Request("https://app.example/api/test",{headers:{host:"app.example",origin:"https://evil.example"}})),false);
 assert.equal(sameOrigin(new Request("https://app.example/api/test",{headers:{host:"app.example",origin:"http://app.example"}})),false);
 assert.equal(sameOrigin(new Request("https://app.example/api/test")),false);
});
