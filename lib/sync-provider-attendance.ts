import "server-only";
import {database} from "./db";
import {attendanceEvidence,mergeAttendanceFlag} from "./provider-attendance";
export async function syncProviderAttendance(webinarId:string,registrants:unknown[]) {
 const db=database(),sessions=await db.from('webinars').select('id,external_id,webinar_date');
 if(sessions.error)throw Error('Attendance session lookup failed');
 const evidence=attendanceEvidence(registrants,webinarId,sessions.data);
 const identities=new Map<string,string[]>();
 for(let start=0;;start+=1000){
  const page=await db.from('contacts').select('id,email').order('id').range(start,start+999);
  if(page.error)throw Error('Attendance contact lookup failed');
  for(const c of page.data){const email=c.email?.trim().toLowerCase();if(email)identities.set(email,[...(identities.get(email)||[]),c.id]);}
  if(page.data.length<1000)break;
 }
 const unmatched=evidence.filter(e=>identities.get(e.email)?.length!==1);
 if(unmatched.length)throw Error(`${unmatched.length} attendance emails have missing or ambiguous identities; no attendance saved`);
 const rows=evidence.map(({email,...e})=>({...e,contact_id:identities.get(email)![0],evidence_source:'provider',updated_at:new Date().toISOString()}));
 // Provider flags are canonical; reimports use the same session/contact keys.
 for(let i=0;i<rows.length;i+=100){
  const batch=rows.slice(i,i+100);
  const existing=await db.from('webinar_attendance').select('webinar_id,contact_id,attended_live,attended_replay').in('contact_id',batch.map(r=>r.contact_id));
  if(existing.error)throw Error('Cannot verify existing attendance evidence');
  for(const row of batch){const old=existing.data.find(r=>r.webinar_id===row.webinar_id&&r.contact_id===row.contact_id);if(old){row.attended_live=mergeAttendanceFlag(old.attended_live,row.attended_live);row.attended_replay=mergeAttendanceFlag(old.attended_replay,row.attended_replay);}}
  const result=await db.from('webinar_attendance').upsert(batch,{onConflict:'webinar_id,contact_id'});if(result.error)throw Error('Provider attendance save failed');
 }
 return {records:rows.length,live:rows.filter(r=>r.attended_live===true).length,replay:rows.filter(r=>r.attended_replay===true).length};
}
