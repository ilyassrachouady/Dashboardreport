import type { Dataset } from "./model";
import { sourceMapping } from "./source-normalization";
import { isBooked } from "./integrations/ghl-bookings";
export function webinarCrmAttribution(data:Dataset, webinarId:string, dimension:"source"|"content"|"campaign") {
 const booked=new Set(data.appointments.filter(a=>a.webinar_id===webinarId && isBooked(a.status)).map(a=>a.contact_id));
 const cohort=new Set([...data.registrations.filter(r=>r.webinar_id===webinarId).map(r=>r.contact_id),...booked]);
 const groups=new Map<string,{name:string;contacts:Set<string>;booked:Set<string>}>();
 const snapshots=new Map((data.crmAttribution||[]).map(r=>[r.ghl_contact_id,r]));
 const seen=new Set<string>();
 for(const c of data.contacts){
  if(!cohort.has(c.id)||!c.ghl_contact_id||seen.has(c.ghl_contact_id))continue;
  seen.add(c.ghl_contact_id);
  const raw=snapshots.get(c.ghl_contact_id)?.[dimension]?.trim()||"";
  const name=(dimension==="source" ? sourceMapping(raw)?.normalized_value : undefined)||raw||"Unattributed";
  const row=groups.get(name)||{name,contacts:new Set<string>(),booked:new Set<string>()};
  row.contacts.add(c.ghl_contact_id);if(booked.has(c.id))row.booked.add(c.ghl_contact_id);groups.set(name,row);
 }
 return [...groups.values()].map(g=>({name:g.name,contacts:g.contacts.size,booked:g.booked.size})).sort((a,b)=>b.booked-a.booked||b.contacts-a.contacts||a.name.localeCompare(b.name));
}
