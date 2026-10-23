import test from "node:test";
import assert from "node:assert/strict";
import { bookingEvidence, matchBookingSource, bookingSourceCounts } from "../lib/booking-source";
import type { Appointment, Webinar } from "../lib/model";
const raw = {id:"e1",type:"ghl_booking",content:{item_id:"ci_live"},data:{calendar:{appointmentId:"a1"},contact_id:"c1",location:{id:"loc"}}};
const evidence = bookingEvidence(raw)!;
const rules = [{webinarId:"w1",contentId:"ci_live",source:"live" as const}];
test("exact appointment, contact and tenant evidence establishes source",()=>{
 assert.deepEqual(matchBookingSource("a1","c1","loc",[evidence],rules),{webinar_id:"w1",booking_source:"live",booking_source_event_id:"e1"});
 for(const [a,c,l]of [["other","c1","loc"],["a1","other","loc"],["a1","c1","other"]]) assert.equal(matchBookingSource(a,c,l,[evidence],rules),null);
});
test("clicks, blank IDs and shared session links never establish booking source",()=>{
 assert.equal(bookingEvidence({...raw,type:"click"}),null);
 assert.equal(bookingEvidence({...raw,data:{}}),null);
 assert.equal(matchBookingSource("a1","c1","loc",[evidence],[...rules,{...rules[0],webinarId:"w2"}]),null);
 assert.equal(matchBookingSource("a1","c1","loc",[evidence],[]),null);
});
test("conflicting provider booking snapshots remain unknown",()=>{
 assert.equal(matchBookingSource("a1","c1","loc",[evidence,{...evidence,contentId:"ci_after"}],[...rules,{webinarId:"w1",contentId:"ci_after",source:"followup"}]),null);
});
test("counts deduplicate people, combine replay and followup, and exclude cancellations",()=>{
 const make=(contact_id:string,booking_source:Appointment['booking_source'],status="confirmed")=>({id:contact_id,contact_id,webinar_id:"w1",booking_source,status,scheduled_at:"",booked_at:"",closer:""});
 const rows=[make("live","live"),make("live","live"),make("after","replay"),make("after","followup"),make("missing",null),make("conflict","live"),make("conflict","followup"),make("cancelled","live","cancelled"),{...make("other","live"),webinar_id:"w2"}];
 assert.deepEqual(bookingSourceCounts(rows,{id:"w1"} as Webinar),{live:1,after:1,unknown:2,total:4});
});
