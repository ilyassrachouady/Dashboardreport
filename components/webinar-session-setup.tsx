"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Webinar } from "../lib/model";
import { SelectControl } from "./form-controls";

const links = [
  ["presenter_url", "Presenter room"], ["slides_url", "Canva slides"],
  ["replay_url", "Wistia replay"], ["notion_page_url", "Notion event"],
  ["live_booking_url", "Live webinar booking link"],
  ["replay_booking_url", "Replay booking link"],
  ["followup_booking_url", "Follow-up booking link"],
] as const;
export function WebinarSessionSetup({ webinar: w }: { webinar: Webinar }) {
  const router = useRouter();
  const [status, setStatus] = useState(w.event_status || "unknown");
  const [promotion, setPromotion] = useState(w.promotion_type || "unknown");
  const [values, setValues] = useState(() => Object.fromEntries(links.map(([key]) => [key, w[key] || ""])));
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/webinar-operations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: w.id, event_status: status, promotion_type: promotion, ...values }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save session");
      setMessage("Session saved"); router.refresh();
    } catch (e) { setMessage(e instanceof Error ? e.message : "Could not save session"); }
    finally { setBusy(false); }
  }
  if (w.notion_managed) return <section className="panel notion-session-summary">
    <div><strong>Managed in Notion</strong><span>{w.notion_updated_at ? `Updated ${new Date(w.notion_updated_at).toLocaleString("en-GB")}` : "Waiting for Notion"}</span></div>
    {w.notion_page_url && <a className="button secondary" href={w.notion_page_url} target="_blank" rel="noopener noreferrer">Open session in Notion ↗</a>}
    {w.notion_error && <p className="error-banner" role="alert">{w.notion_error}</p>}
    <nav aria-label="Session resources">{links.filter(([key])=>key!=="notion_page_url"&&Boolean(w[key])).map(([key,label])=><a key={key} href={w[key]!} target="_blank" rel="noopener noreferrer">{label} ↗</a>)}</nav>
  </section>;
  return <details className="panel session-setup">
    <summary><span>Session setup</span><span>Links & moderator checklist</span></summary>
    <form onSubmit={save}>
      <div className="session-setup-grid">
        <label>Status<SelectControl value={status} onValueChange={value => setStatus(value as typeof status)}>
          <option value="unknown">Not set</option><option value="planned">Planned</option><option value="ready">Ready</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option>
        </SelectControl></label>
        <label>Promotion<SelectControl value={promotion} onValueChange={value => setPromotion(value as typeof promotion)}>
          <option value="unknown">Not set</option><option value="organic">Organic</option><option value="paid">Paid</option><option value="mixed">Organic & paid</option>
        </SelectControl></label>
        {links.map(([key, label]) => <label key={key}>{label}<div className="session-link-input"><input type="url" placeholder="https://" value={values[key]} onChange={e => setValues(v => ({ ...v, [key]: e.target.value }))} maxLength={2048} />{values[key]?.startsWith("https://") && <a href={values[key]} target="_blank" rel="noopener noreferrer" aria-label={`Open ${label}`}>↗</a>}</div></label>)}
      </div>
      <div className="session-checklist">
        <h3>Moderator checklist</h3>
        <div><span>Before</span><p>Check presenter access, slides and the live booking link.</p></div>
        <div><span>After</span><p>Save peak and pitch counts in this session’s report, then add the replay and follow-up links here.</p></div>
      </div>
      <div className="session-setup-footer"><button className="button primary" disabled={busy}>{busy ? "Saving…" : "Save session"}</button><span role="status">{message}</span></div>
    </form>
  </details>;
}
