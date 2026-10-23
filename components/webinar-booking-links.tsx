"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Webinar } from "../lib/model";
const fields = [["live_booking_url","Live webinar"],["replay_booking_url","Replay"],["followup_booking_url","Follow-up email"],["whatsapp_booking_url","WhatsApp follow-up"]] as const;
export function WebinarBookingLinks({webinar}:{webinar:Webinar}) {
  const router = useRouter();
  const [values,setValues] = useState(()=>Object.fromEntries(fields.map(([key])=>[key,webinar[key] || ""])));
  const [busy,setBusy] = useState(false), [message,setMessage] = useState("");
  async function save(event:React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/webinar-booking-links",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:webinar.id,...values})});
      const body = await response.json(); if(!response.ok) throw new Error(body.error || "Could not save links");
      setMessage("Saved. Sync CRM to refresh booking sources."); router.refresh();
    } catch(e) {setMessage(e instanceof Error ? e.message : "Could not save links");} finally {setBusy(false);}
  }
  return <details className="panel session-setup"><summary><span>Booking attribution</span><span>Tracked links</span></summary>
    <form onSubmit={save}><div className="session-setup-grid">{fields.map(([key,label])=><label key={key}>{label}<input type="url" placeholder="https://go.…" maxLength={2048} value={values[key]} onChange={e=>setValues(v=>({...v,[key]:e.target.value}))}/></label>)}</div>
    <div className="session-setup-footer"><button className="button primary" disabled={busy}>{busy?"Saving…":"Save booking links"}</button><span role="status">{message}</span></div></form>
  </details>;
}
