import test from 'node:test';
import assert from 'node:assert/strict';
import {adaptTrakyoLead} from '../lib/integrations/trakyo';
import {adaptWebinarRegistrant,webinarTimestamp} from '../lib/integrations/webinars';
test('Trakyo lead maps stable identity, immutable revisions and distinct attribution touches',()=>{
 const raw={id:'lead_test',created_at:'2026-10-14T12:00:00Z',identifiers:{emails:['TEST@example.com'],phones:[],names:['Sam Jones']},first_touch:{type:'youtube',name:'Video title',source_name:null,content_item:'ci_1',occurred_at:'2026-10-13T12:00:00Z'},last_touch:null};
 const a=adaptTrakyoLead(raw);assert.equal(a.contact.email,'test@example.com');assert.equal(a.touches[0].source,'youtube');assert.equal(a.touches[0].content,'Video title');assert.equal(adaptTrakyoLead(raw).event_id,a.event_id);
 const changed=adaptTrakyoLead({...raw,last_touch:{...raw.first_touch,occurred_at:'2026-10-14T12:00:00Z'}});assert.notEqual(changed.event_id,a.event_id);assert.equal(changed.touches[0].external_touch_id,a.touches[0].external_touch_id);
});
test('WebinarJam uses the webinar timezone, matches schedules and leaves unavailable metrics null',()=>{
 assert.equal(webinarTimestamp('2026-10-14 20:00','Europe/London'),'2026-10-14T19:00:00.000Z');
 const details={webinar_id:1,name:'Test',timezone:'Europe/London',schedules:[{date:'2026-10-14 20:00',schedule:2}]};
 const raw={id:5,schedule_id:2,event_id:4,email:'test@example.com',signup_date:'Wed, 14 Oct 2026, 06:00 PM',utm_source:'YouTube'};
 const e=adaptWebinarRegistrant(raw,details);assert.equal(e.registrations[0].registered_at,'2026-10-14T17:00:00.000Z');assert.equal(e.webinars[0].peak_attendees,null);assert.equal(e.webinars[0].pitch_attendees,null);assert.equal(e.registrations[0].raw_utm_source,'YouTube');assert.throws(()=>adaptWebinarRegistrant({...raw,schedule_id:99},details));
});

test('unused checkout attempts are not counted as separate closed sales', async()=>{
 const {paymentDeskEvents}=await import('../lib/integrations/payment-desk');
 const contact={ghl_contact_id:'ghl-test',email:'test@example.com',full_name:'Sam'};
 const call={id:'call1',call_id:'scheduled1',checkout_session_id:'checkout1',ghl_contact_id:'ghl-test',mode:'live',outcome:'sold',attendance:'attended',closer_name:'Closer',created_at:'2026-10-14T12:00:00Z'};
 const session={id:'checkout1',call_id:'scheduled1',mode:'live',metadata:{ghl_contact_id:'ghl-test',offer_name:'Coaching'},payment_type:'pif',contract_value:199700,created_at:'2026-10-14T12:00:00Z'};
 const events=paymentDeskEvents([contact],[call],[session,{...session,id:'unused-checkout'}],[]);
 assert.deepEqual(events.flatMap(e=>e.sales.map(s=>s.external_id)),['checkout1']);
});
