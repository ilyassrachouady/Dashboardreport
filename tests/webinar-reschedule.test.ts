import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileRegistrantSchedules} from '../lib/integrations/webinars';
const details={webinar_id:2,name:'Session',timezone:'America/New_York',schedules:[{schedule:2,date:'2026-10-14 20:00'},{schedule:5,date:'2026-11-01 13:00'}]};
const row={id:1,schedule_id:2,event_id:5,email:'test@example.com',signup_date:'2026-10-30 10:00',event:'Sun, 1 Nov 2026, 01:00 PM'};
test('rescheduled registrants follow explicit event date while historical rows stay unchanged',()=>{
 const historical={...row,id:2,event_id:2,event:'Wed, 14 Oct 2026, 08:00 PM'};
 const out=reconcileRegistrantSchedules(details,[row,historical]) as typeof row[];
 assert.equal(out[0].schedule_id,5);assert.equal(out[0].event_id,5);assert.deepEqual(out[1],historical);assert.equal(row.schedule_id,2);
});
test('signup dates and missing event dates never reassign an occurrence',()=>{
 const noDate={...row,event:undefined};assert.deepEqual(reconcileRegistrantSchedules(details,[noDate]),[noDate]);
});
test('ambiguous and unmatched explicit event dates stop the import',()=>{
 assert.throws(()=>reconcileRegistrantSchedules({...details,schedules:[...details.schedules,{schedule:6,date:'2026-11-01 13:00'}]},[row]),/unique/);
 assert.throws(()=>reconcileRegistrantSchedules(details,[{...row,event:'2026-11-08 13:00'}]),/unique/);
});
