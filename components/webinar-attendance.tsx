"use client";
import { useEffect, useState } from "react";
import { parseAttendanceCsv, attendanceImportSchema } from "../lib/webinar-attendance-import";
type Row = { id: string; attended_live: boolean | null; attended_replay: boolean | null; contacts: {first_name:string;last_name:string;email:string|null} | null };
export function WebinarAttendance({ webinarId }: { webinarId: string }) {
  const [rows,setRows]=useState<Row[]>([]), [error,setError]=useState("");
  const [incoming,setIncoming]=useState<ReturnType<typeof parseAttendanceCsv>>([]);
  const [preview,setPreview]=useState<{matched:number;unmatched:string[];total:number}|null>(null);
  const [busy,setBusy]=useState(false), [message,setMessage]=useState("");
  async function load(signal?:AbortSignal) {
    try {const r=await fetch(`/api/webinar-attendance?webinar_id=${encodeURIComponent(webinarId)}`,{cache:"no-store",signal});const v=await r.json();if(!r.ok)throw Error(v.error);setRows(v.rows);setError("");}
    catch(e){if(!signal?.aborted)setError(e instanceof Error?e.message:"Attendance unavailable");}
  }
  useEffect(()=>{const c=new AbortController();void load(c.signal);return()=>c.abort();},[webinarId]);
  async function send(save:boolean) {
    setBusy(true);setMessage("");
    try {
      const data=attendanceImportSchema.parse({webinar_id:webinarId,preview:!save,rows:incoming});
      const r=await fetch("/api/webinar-attendance",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});const v=await r.json();if(!r.ok)throw Error(v.error);
      if(save){setMessage(`${v.imported} attendance records saved`);setPreview(null);setIncoming([]);await load();}else setPreview(v);
    }catch(e){setMessage(e instanceof Error?e.message:"Import failed");}finally{setBusy(false);}
  }
  const flag=(value:boolean|null)=>value===null?"Unknown":value?"Yes":"No";
  return <details className="panel session-setup">
    <summary><span>Webinar attendance</span><span>{rows.length ? `${rows.length} people · this session` : "Import verified attendance"}</span></summary>
    <div className="attendance-import">
      {error && <p className="error-banner">{error}</p>}
      <p>Use verified WebinarJam attendance, not the registration list. Blank means unknown; it never means absent.</p>
      <a className="quiet" download="webinar-attendance-template.csv" href={"data:text/csv;charset=utf-8,"+encodeURIComponent("email,attended_live,attended_replay\n")}>Download CSV template ↗</a>
      <label className="attendance-file-label">Attendance CSV<input type="file" accept=".csv,text/csv" disabled={busy} onChange={async e=>{
        setPreview(null);setIncoming([]);setMessage("");const file=e.target.files?.[0];if(!file)return;
        try{if(file.size>1000000)throw Error("Use a CSV smaller than 1 MB.");const parsed=parseAttendanceCsv(await file.text());attendanceImportSchema.parse({webinar_id:webinarId,rows:parsed});setIncoming(parsed);}catch(err){setMessage(err instanceof Error?err.message:"Invalid CSV");}
      }}/></label>
      <div className="session-setup-footer">
        <button type="button" className="button secondary" disabled={!incoming.length||busy} onClick={()=>void send(false)}>{busy?"Working…":"Check matches"}</button>
        {preview && <><span>{preview.matched} matched · {preview.unmatched.length} unmatched</span><button type="button" className="button primary" disabled={busy||preview.unmatched.length>0} onClick={()=>void send(true)}>Import attendance</button></>}
      </div>
      {preview?.unmatched.length ? <p>Unmatched: {preview.unmatched.join(", ")}</p>:null}
      <p role="status">{message}</p>
      {!!rows.length && <div className="table-scroll"><table><thead><tr><th>Person</th><th>Email</th><th>Live</th><th>Replay</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{[r.contacts?.first_name,r.contacts?.last_name].filter(Boolean).join(" ")||"CRM contact"}</td><td>{r.contacts?.email||"—"}</td><td>{flag(r.attended_live)}</td><td>{flag(r.attended_replay)}</td></tr>)}</tbody></table></div>}
    </div>
  </details>;
}
