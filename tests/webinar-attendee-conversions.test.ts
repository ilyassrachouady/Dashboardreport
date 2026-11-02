import test from "node:test";
import assert from "node:assert/strict";
import { emptyDataset, type Appointment, type Contact } from "../lib/model";
import { webinarKpis } from "../lib/webinar-kpis";
const w = {id:"w",external_id:"e",name:"Webinar",webinar_date:"2026-10-14T19:00:00Z",webinar_ended_at:"2026-10-14T21:00:00Z",peak_attendees:2,pitch_attendees:1,application_count:100,call_booked_count:100};
function fixture() {
 const d=emptyDataset();
 d.contacts=["a","b","replay","absent"].map(id=>({id,ghl_contact_id:id})) as Contact[];
 d.webinarAttendance=[
  {webinar_id:"w",contact_id:"a",attended_live:true,attended_replay:false},
  {webinar_id:"w",contact_id:"a",attended_live:true,attended_replay:false},
  {webinar_id:"w",contact_id:"b",attended_live:true,attended_replay:false},
  {webinar_id:"w",contact_id:"replay",attended_live:false,attended_replay:true},
  {webinar_id:"other",contact_id:"absent",attended_live:true,attended_replay:false},
 ];
 d.crmApplications=["a","replay","absent"].map(id=>({ghl_contact_id:id,applied:true}));
 const booking=(id:string,contact:string,time:string,status="confirmed")=>({id,contact_id:contact,webinar_id:"w",booked_at:time,status}) as Appointment;
 d.appointments=[booking("1","a","2026-10-14T20:00:00Z"),booking("2","a","2026-10-15T20:00:00Z"),booking("3","replay","2026-10-15T20:00:00Z"),booking("4","b","2026-10-15T20:00:00Z","cancelled"),booking("5","b","2026-10-14T18:00:00Z")];
 return d;
}
test("rates use the same confirmed live audience; exclude replay, tags, other sessions and cancelled/pre-session bookings",()=>{
 const k=webinarKpis(fixture(),w);
 assert.equal(k.conversions.liveAttendees,2);
 assert.equal(k.conversions.applicants,1);
 assert.equal(k.conversions.booked,1);
 assert.equal(k.application,1);
 assert.equal(k.booking,1);
 assert.equal(k.applicantBooking,1);
 assert.equal(k.conversions.bookingsWithoutLiveAttendance,1);
 // A repeat booking does not turn an existing during-webinar booking into a new later conversion.
 assert.equal(k.conversions.afterBookings,1);
 assert.equal(k.conversions.afterAttendees,0);
 assert.equal(k.conversions.afterWithoutLiveAttendance,1);
});
test("missing evidence, upcoming sessions and failed CRM refresh do not manufacture zero conversion rates",()=>{
 const d=fixture();
 assert.equal(webinarKpis(d,{...w,webinar_date:"2099-01-01T00:00:00Z"}).booking,null);
 d.webinarAttendance=undefined;
 assert.equal(webinarKpis(d,w).booking,null);
 d.webinarAttendance=fixture().webinarAttendance;
 d.crmApplicationsError="Refresh failed";
 assert.equal(webinarKpis(d,w).application,null);
 assert.equal(webinarKpis(d,w).booking,1);
});
test("missing or invalid end time stays unknown; follow-up links never establish elapsed time",()=>{
 const d=fixture();d.appointments[2].booking_source="followup";
 assert.equal(webinarKpis(d,{...w,webinar_ended_at:null}).conversions.afterBookings,null);
 assert.equal(webinarKpis(d,{...w,webinar_ended_at:"2026-10-14T18:00:00Z"}).conversions.afterBookings,null);
 assert.equal(webinarKpis(d,w).conversions.followupBookings,1);
});

test("application rate uses pitch attendance, stays unknown without it, and rejects impossible subsets",()=>{
 const d=fixture();
 assert.equal(webinarKpis(d,{...w,pitch_attendees:2}).application,.5);
 assert.equal(webinarKpis(d,{...w,pitch_attendees:null}).application,null);
 assert.equal(webinarKpis(d,{...w,pitch_attendees:0}).application,null);
 assert.equal(webinarKpis(d,{...w,pitch_attendees:null}).booking,null);
});

test("call booked rate uses people at pitch and never substitutes live, peak or aggregate bookings",()=>{
 const d=fixture();
 assert.equal(webinarKpis(d,{...w,pitch_attendees:2}).booking,.5);
 assert.equal(webinarKpis(d,{...w,pitch_attendees:0}).booking,null);
 const k=webinarKpis(d,{...w,pitch_attendees:0});
 assert.ok(k.issues.includes("Attendee bookings exceed pitch audience"));
 const sixtyTwo={...w,pitch_attendees:62,peak_attendees:72};
 assert.equal(webinarKpis(d,sixtyTwo).booking,1/62);
});

test("TCS002 omits application rate while retaining applicant counts and pitch-based bookings",()=>{
 const d=fixture();
 const session={...w,session_code:'TCS002',pitch_attendees:58};
 const k=webinarKpis(d,session);
 assert.equal(k.showApplicationRate,false);
 assert.equal(k.application,null);
 assert.equal(k.conversions.applicants,1);
 assert.equal(k.booking,1/58);
 assert.equal(webinarKpis(d,{...w,external_id:'webinarjam:2:5:5'}).showApplicationRate,false);
 assert.equal(webinarKpis(d,{...w,session_code:'TCS001'}).showApplicationRate,true);
 assert.equal(webinarKpis(d,{...w,session_code:'QUE001'}).application,1);
});
