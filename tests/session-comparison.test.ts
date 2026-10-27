import test from "node:test";
import assert from "node:assert/strict";
import {emptyDataset, type Contact, type Registration} from "../lib/model";
import {sessionCrmMetrics} from "../lib/session-comparison";
test("session sales comparison uses distinct registered CRM contacts and PIF share among classified sold contacts",()=>{
 const d=emptyDataset();
 const w={id:"w",external_id:"e",name:"Session",webinar_date:"2026-10-14T00:00:00Z",peak_attendees:null,pitch_attendees:null};
 d.contacts=[{id:"a",ghl_contact_id:"ga",created_at:"2026-10-13T00:00:00Z"},{id:"b",ghl_contact_id:"gb",created_at:"2026-10-13T00:00:00Z"},{id:"other",ghl_contact_id:"gc",created_at:"2026-10-13T00:00:00Z"}] as Contact[];
 d.registrations=[{id:"r1",contact_id:"a",webinar_id:"w",registered_at:"2026-10-13T00:00:00Z"},{id:"r2",contact_id:"a",webinar_id:"w",registered_at:"2026-10-13T00:00:00Z"},{id:"r3",contact_id:"b",webinar_id:"w",registered_at:"2026-10-13T00:00:00Z"}] as Registration[];
 const base={closer:"Brooklyn",attendance:"Attended",outcome:"Sold",structure:"Pay in Full (PIF)",cashCents:199700,contractCents:199700};
 d.crmCallSnapshots=[{...base,ghl_contact_id:"ga"},{...base,ghl_contact_id:"gb",structure:"Manual Payment Plan",cashCents:80000},{...base,ghl_contact_id:"gc"}];
 assert.deepEqual(sessionCrmMetrics(d,w),{sold:2,pif:1,pifRate:.5,cash:279700});
 assert.equal(sessionCrmMetrics(d,{...w,webinar_date:"2099-01-01T00:00:00Z"}).sold,null);
});
