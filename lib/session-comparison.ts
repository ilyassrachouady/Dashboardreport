import type { Dataset, Webinar } from "./model";
import {defaultFilters} from "./model";
import {crmPerformance} from "./crm-performance";
export function sessionCrmMetrics(data:Dataset,session:Webinar,now=Date.now()) {
 const available=data.crmCallSnapshots!==undefined && !data.crmSnapshotError && !data.crmStructuresError && Date.parse(session.webinar_date)<=now;
 const p=crmPerformance(data,{...defaultFilters,webinar:session.id});
 const soldIds=new Set((data.crmCallSnapshots||[]).filter(c=>c.outcome.trim().toLowerCase()==="sold").map(c=>c.ghl_contact_id));
 const soldOnly={...data,crmCallSnapshots:data.crmCallSnapshots?.filter(c=>soldIds.has(c.ghl_contact_id))};
 const sales=crmPerformance(soldOnly,{...defaultFilters,webinar:session.id});
 return {sold:available?p.sold:null,pif:available?sales.pif:null,pifRate:available?sales.pifRate:null,cash:available?p.cash:null};
}
