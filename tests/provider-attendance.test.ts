import test from 'node:test';import assert from 'node:assert/strict';
import{attendanceFlag,attendanceEvidence,mergeAttendanceFlag}from'../lib/provider-attendance';
test('WebinarJam Yes/No flags are explicit evidence; unknown is never absent',()=>{assert.equal(attendanceFlag('Yes'),true);assert.equal(attendanceFlag('No'),false);assert.equal(attendanceFlag(undefined),null);assert.equal(attendanceFlag(''),null);});
test('attendance stays session-specific, future No flags unknown and duplicate emails count once',()=>{
 const sessions=[{id:'old',external_id:'webinarjam:2:2:2',webinar_date:'2026-10-15T00:00:00Z'},{id:'future',external_id:'webinarjam:2:5:5',webinar_date:'2026-10-28T23:00:00Z'}];
 const row={email:' A@example.com ',schedule_id:2,event_id:2,attended_live:'Yes',attended_replay:'No'};
 const out=attendanceEvidence([row,{...row,attended_live:'No'},{...row,schedule_id:5,event_id:5,attended_live:'No'},{...row,event_id:999}],'2',sessions,Date.parse('2026-10-23'));
 assert.deepEqual(out,[{webinar_id:'old',email:'a@example.com',attended_live:true,attended_replay:false}]);
});

test('historical attendance survives missing fields and later provider resets',()=>{
 assert.equal(mergeAttendanceFlag(true,null),true);assert.equal(mergeAttendanceFlag(true,false),true);
 assert.equal(mergeAttendanceFlag(false,true),true);assert.equal(mergeAttendanceFlag(null,false),false);assert.equal(mergeAttendanceFlag(null,null),null);
});
