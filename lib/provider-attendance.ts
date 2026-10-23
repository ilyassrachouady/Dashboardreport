// Attendance means the person attended at least once. Missing fields or later
// provider resets must not erase an already verified historical positive.
export function mergeAttendanceFlag(previous:boolean|null,next:boolean|null):boolean|null {
 return previous===true||next===true?true:next===null?previous:next;
}
export function attendanceFlag(value:unknown):boolean|null {
 if(value===true||value===1)return true;
 if(value===false||value===0)return false;
 if(typeof value==='string'){
  const v=value.trim().toLowerCase();
  if(v==='yes'||v==='1'||v==='true')return true;
  if(v==='no'||v==='0'||v==='false')return false;
 }
 return null;
}
export function attendanceEvidence(rows:unknown[],webinarId:string,sessions:Array<{id:string;external_id:string;webinar_date:string}>,now=Date.now()) {
 const groups=new Map<string,{webinar_id:string;email:string;attended_live:boolean|null;attended_replay:boolean|null}>();
 for(const raw of rows){
  const r=raw as Record<string,unknown>;
  if(!r||r.event_id==null||r.schedule_id==null||typeof r.email!=='string')continue;
  const session=sessions.find(w=>w.external_id===`webinarjam:${webinarId}:${r.schedule_id}:${r.event_id}`);
  if(!session)continue;
  const email=r.email.trim().toLowerCase();if(!email)continue;
  let live=attendanceFlag(r.attended_live),replay=attendanceFlag(r.attended_replay);
  // A future registration with No attendance is not an absence record.
  if(Date.parse(session.webinar_date)>now)continue;
  if(live===null&&replay===null)continue;
  const key=`${session.id}:${email}`,previous=groups.get(key);
  const merge=(a:boolean|null,b:boolean|null)=>a===true||b===true?true:a===false||b===false?false:null;
  groups.set(key,{webinar_id:session.id,email,attended_live:merge(previous?.attended_live??null,live),attended_replay:merge(previous?.attended_replay??null,replay)});
 }
 return [...groups.values()];
}
