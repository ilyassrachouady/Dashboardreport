"use client";
import {useState} from "react";
import type {Dataset} from "../lib/model";
import {webinarCrmAttribution} from "../lib/webinar-crm-attribution";
import {SelectControl} from "./form-controls";
import {MetricHelp} from "./metric-help";
export function WebinarCrmAttribution({data,webinarId}:{data:Dataset;webinarId:string}) {
 const [dimension,setDimension]=useState<"source"|"content"|"campaign">("source");
 const rows=webinarCrmAttribution(data,webinarId,dimension);
 return <section className="panel"><div className="panel-head"><div><h2>CRM attribution</h2><MetricHelp>Current GHL Trakyo fields for this session’s registered and booked contacts. Contact attribution is separate from a specific appointment’s booking channel. Blank fields remain Unattributed.</MetricHelp></div><SelectControl aria-label="CRM attribution dimension" value={dimension} onValueChange={v=>setDimension(v as typeof dimension)}><option value="source">Source</option><option value="content">Content</option><option value="campaign">Campaign</option></SelectControl></div>
 {data.crmAttribution===undefined || data.crmStructuresError ? <p className="error-banner">GHL attribution is unavailable.</p> : <div className="table-scroll"><table><thead><tr><th>{dimension[0].toUpperCase()+dimension.slice(1)}</th><th>Contacts</th><th>Booked contacts</th></tr></thead><tbody>{rows.map(r=><tr key={r.name}><td>{r.name}</td><td>{r.contacts}</td><td>{r.booked}</td></tr>)}</tbody></table></div>}
 </section>;
}
