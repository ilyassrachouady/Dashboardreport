import "server-only";
import {database} from "./db";
import {fetchGhlContacts} from "./integrations/ghl";
export async function syncAttendanceTags() {
 const db=database();
 const sessions=await db.from('webinars').select('id,ghl_cohort_tag');
 if(sessions.error)throw Error('Attendance tag session lookup failed');
 const tags=new Map(sessions.data.filter(w=>/^\d{1,2}[a-z]{3}\d{4}-registered$/.test(w.ghl_cohort_tag||'')).map(w=>[w.id,w.ghl_cohort_tag!.replace(/-registered$/,'-attended')]));
 if(!tags.size)return {tagged:0,unlinked:0};
 const evidence=[];
 for(let start=0;;start+=1000){const r=await db.from('webinar_attendance').select('id,webinar_id,contacts(ghl_contact_id)').eq('attended_live',true).order('id').range(start,start+999);if(r.error)throw Error('Verified attendance tag lookup failed');evidence.push(...r.data);if(r.data.length<1000)break;}
 if(!evidence.length)return {tagged:0,unlinked:0};
 const contacts=new Map((await fetchGhlContacts()).map(raw=>{const c=raw as {id:string;locationId:string;tags?:string[]};if(c.locationId!==process.env.GHL_LOCATION_ID)throw Error('Attendance tag location mismatch');return[c.id,c];}));
 let tagged=0,unlinked=0;const seen=new Set<string>();
 for(const row of evidence){
  const tag=tags.get(row.webinar_id);if(!tag)continue;
  const relation=row.contacts as unknown as {ghl_contact_id:string|null}|null;
  const id=relation?.ghl_contact_id,c=id?contacts.get(id):undefined;
  if(!id||!c){unlinked++;continue;}
  if(c.tags?.includes(tag)||seen.has(`${id}:${tag}`))continue;
  const response=await fetch(`https://services.leadconnectorhq.com/contacts/${encodeURIComponent(id)}/tags`,{method:'POST',headers:{Authorization:`Bearer ${process.env.GHL_API_KEY}`,Version:'v3','Content-Type':'application/json'},body:JSON.stringify({tags:[tag]}),signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error(`GHL attended tag update failed (${response.status})`);
  const saved=await response.json();if(!Array.isArray(saved.tags)||!saved.tags.includes(tag))throw Error('GHL attended tag update could not be verified');
  seen.add(`${id}:${tag}`);tagged++;
 }
 return {tagged,unlinked};
}
