"use client";
import { SelectControl } from "./form-controls";
import { ReportVisuals, SessionComparisonChart } from "./report-visuals";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Pencil,
  Check,
  X,
  ArrowRight,
  ArrowUpRight,
  Users,
  CalendarDays,
  CheckCircle2,
  CircleDashed,
  Download,
  RefreshCw,
  Info,
} from "lucide-react";
import type { Dataset, Webinar } from "../lib/model";
import { defaultFilters } from "../lib/model";
import { dimensions, csv } from "../lib/reporting";
import { registrantReview } from "../lib/webinar-reconciliation";
import { webinarKpis } from "../lib/webinar-kpis";
const inputs = [
  [
    "peak_attendees",
    "Peak attendees",
    "Largest live audience shown in WebinarJam.",
  ],
  [
    "pitch_attendees",
    "People at pitch",
    "Live audience when the offer was presented.",
  ],
  [
    "application_count",
    "Applicants",
    "Unique people with Application = Yes for this session.",
  ],
  [
    "call_booked_count",
    "Calls booked",
    "Unique people who booked a call from this session.",
  ],
  [
    "applicant_booked_count",
    "Applicants who booked",
    "Booked people who also have Application = Yes.",
  ],
] as const;
const pct = (value: number | null) =>
  value === null ? "—" : `${(value * 100).toFixed(1)}%`;
function exportReport(data: Dataset, webinars: Webinar[]) {
  const rows = webinars.map((w) => {
    const k = webinarKpis(data, w);
    return {
      webinar: w.name,
      date: w.webinar_date,
      registrants: k.registrants,
      peak: w.peak_attendees,
      pitch: w.pitch_attendees,
      applicants: w.application_count ?? null,
      calls_booked: w.call_booked_count ?? null,
      applicants_booked: w.applicant_booked_count ?? null,
      attendance_rate: pct(k.attendance),
      retention_rate: pct(k.retention),
      application_rate: pct(k.application),
      call_booked_rate: pct(k.booking),
      applicant_booking_rate: pct(k.applicantBooking),
    };
  });
  const url = URL.createObjectURL(
    new Blob([csv(rows)], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "webinar-performance.csv";
  a.click();
  URL.revokeObjectURL(url);
}
export function WebinarReports({
  data,
  onSource,
}: {
  data: Dataset;
  onSource: (source: string, webinar: string) => void;
}) {
  const webinars = [...data.webinars].sort((a, b) =>
    b.webinar_date.localeCompare(a.webinar_date),
  );
  const [selected, setSelected] = useState(webinars[0]?.id || ""),
    [compare, setCompare] = useState(false);
  const w = webinars.find((w) => w.id === selected) || webinars[0];
  if (!w)
    return (
      <div className="report-empty panel">
        <CalendarDays size={26} />
        <h2>Your first webinar report starts here</h2>
        <p>
          Sync WebinarJam in Data Sources to bring in your sessions and
          registrants.
        </p>
      </div>
    );
  return (
    <div className="report-workspace">
      <div className="report-toolbar">
        <label>
          <CalendarDays size={16} />
          <span>Session</span>
          <SelectControl
            aria-label="Report session"
            value={w.id}
            onValueChange={(value) => setSelected(value)}
          >
            {webinars.map((s) => (
              <option key={s.id} value={s.id}>
                {new Date(s.webinar_date).toLocaleDateString("en-GB")} ·{" "}
                {s.name}
              </option>
            ))}
          </SelectControl>
        </label>
        <div className="report-toolbar-actions">
          <div className="report-toggle" aria-label="Report view">
            <button
              aria-pressed={!compare}
              className={!compare ? "selected" : ""}
              onClick={() => setCompare(false)}
            >
              Session report
            </button>
            <button
              aria-pressed={compare}
              className={compare ? "selected" : ""}
              onClick={() => setCompare(true)}
            >
              Compare sessions
            </button>
          </div>
          <button
            className="button"
            onClick={() => exportReport(data, compare ? webinars : [w])}
          >
            <Download size={14} />
            Export report
          </button>
        </div>
      </div>
      {compare ? (
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Session comparison</h2>
              <p>
                Same five definitions across every webinar. Select a row to
                explore.
              </p>
            </div>
          </div>
          <SessionComparisonChart data={data} webinars={webinars} />
          <div className="table-scroll report-compare">
            <table>
              <thead>
                <tr>
                  {[
                    "Session",
                    "Registrants",
                    "Attendance",
                    "Retention",
                    "Application",
                    "Call booked",
                    "Applicant → booking",
                  ].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {webinars.map((s) => {
                  const k = webinarKpis(data, s);
                  return (
                    <tr key={s.id}>
                      <td>
                        <button
                          className="comparison-session"
                          onClick={() => {
                            setSelected(s.id);
                            setCompare(false);
                          }}
                        >
                          {s.name}
                          <ArrowUpRight size={13} />
                        </button>
                        <small>
                          {new Date(s.webinar_date).toLocaleDateString("en-GB")}
                        </small>
                      </td>
                      <td>{k.registrants}</td>
                      {[
                        k.attendance,
                        k.retention,
                        k.application,
                        k.booking,
                        k.applicantBooking,
                      ].map((v, i) => (
                        <td key={i}>{pct(v)}</td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <WebinarPerformance
          key={w.id}
          data={data}
          webinar={w}
          onSource={(source) => onSource(source, w.id)}
        />
      )}
    </div>
  );
}
export function WebinarPerformance({
  data,
  webinar: w,
  onSource,
}: {
  data: Dataset;
  webinar: Webinar;
  onSource?: (source: string) => void;
}) {
  const router = useRouter();
  const editorRef = useRef<HTMLElement>(null);
  const [chartView, setChartView] = useState<"Funnel" | "Bars" | "Table">(
    "Funnel",
  );
  const [editing, setEditing] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [values, setValues] = useState(() =>
    Object.fromEntries(
      inputs.map(([key]) => [key, w[key] == null ? "" : String(w[key])]),
    ),
  );
  const crm = data.webinarCrm?.[w.id];
  const k = webinarKpis(data, w),
    known = inputs.filter(([key]) => w[key] != null).length;
  const reconciliation = registrantReview(w.external_id, k.registrants);
  const cards = [
    [
      "Attendance rate",
      k.attendance,
      `${w.peak_attendees ?? "—"} peak / ${k.registrants} registrants`,
      "How many registrants were present at the live audience peak.",
    ],
    [
      "Retention rate",
      k.retention,
      `${w.pitch_attendees ?? "—"} at pitch / ${w.peak_attendees ?? "—"} peak`,
      "How much of the peak audience remained when the pitch started.",
    ],
    [
      "Application rate",
      k.application,
      `${w.application_count ?? "—"} applicants / ${w.pitch_attendees ?? "—"} at pitch`,
      "Unique applicants as a share of the pitch audience.",
    ],
    [
      "Call booked rate",
      k.booking,
      `${w.call_booked_count ?? "—"} booked / ${w.pitch_attendees ?? "—"} at pitch`,
      "Unique booked contacts as a share of the pitch audience.",
    ],
    [
      "Applicant-to-booking rate",
      k.applicantBooking,
      `${w.applicant_booked_count ?? "—"} booked applicants / ${w.application_count ?? "—"} applicants`,
      "Only booked contacts with Application = Yes are counted.",
    ],
  ] as const;
  const registrants = new Set(
    data.registrations
      .filter((r) => r.webinar_id === w.id)
      .map((r) => r.contact_id),
  );
  const sources = new Map<string, number>();
  for (const c of data.contacts) {
    if (!registrants.has(c.id)) continue;
    const source = dimensions(data, c.id, {
      ...defaultFilters,
      webinar: w.id,
    }).source;
    sources.set(source, (sources.get(source) || 0) + 1);
  }
  const ranked = [...sources].sort((a, b) => b[1] - a[1]);
  const attributed = k.registrants - (sources.get("(not set)") || 0);
  const stages = [
    ["Registered", k.registrants, "WebinarJam"],
    ["Peak audience", w.peak_attendees, "Live attendance peak"],
    ["At the pitch", w.pitch_attendees, "Audience at offer"],
  ] as const;
  function openEditor() {
    setValues(
      Object.fromEntries(
        inputs.map(([key]) => [key, w[key] == null ? "" : String(w[key])]),
      ),
    );
    setEditing(true);
    setMessage("");
  }
  async function syncApplicants() {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/webinar-ghl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: w.id }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error);
      setMessage("Applicants and calendar bookings synced from GHL.");
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "CRM sync failed");
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/webinar-kpis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: w.id,
          ...Object.fromEntries(
            inputs.map(([key]) => [
              key,
              values[key] === "" ? null : Number(values[key]),
            ]),
          ),
        }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error);
      setEditing(false);
      setMessage("Session counts saved.");
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <section className="report-session-header">
        <div>
          <span className="report-kicker">WEBINAR PERFORMANCE</span>
          <h2>{w.name}</h2>
          <p>
            <CalendarDays size={13} />
            {new Date(w.webinar_date).toLocaleString("en-GB", {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: "UTC",
            })}{" "}
            UTC
            <span className="report-separator" />
            Full session
          </p>
        </div>
        <span
          className={`report-readiness ${known === 5 && !reconciliation ? "complete" : ""}`}
        >
          {known === 5 && !reconciliation ? (
            <CheckCircle2 size={14} />
          ) : (
            <CircleDashed size={14} />
          )}{" "}
          {reconciliation
            ? "Data review needed"
            : known === 5
              ? "Report complete"
              : `${known + 1} of 6 inputs ready`}
        </span>
      </section>
      {known < 5 && (
        <div className="report-action">
          <span className="report-action-icon">
            <Info size={18} />
          </span>
          <div>
            <strong>Complete the picture</strong>
            <p>
              Registrants are synced. Add {5 - known} missing session count
              {known === 4 ? "" : "s"} to calculate the remaining rates.
            </p>
          </div>
          <button className="button" onClick={openEditor}>
            Complete report
            <ArrowRight size={14} />
          </button>
        </div>
      )}
      {reconciliation && (
        <div className="report-reconciliation" role="status">
          <Info size={17} />
          <div>
            <strong>Registrant total needs review</strong>
            <p>
              {reconciliation.importedUnique} unique registrants are imported.
              Your analytics CSV reports {reconciliation.registrants} — a
              difference of {reconciliation.difference}. Rates currently use the
              imported unique count; do not treat the attendance rate as
              reconciled yet.
            </p>
            <small>
              API check: all 11 pages returned 274 distinct records for schedule
              2 / event 2 on 20 Oct 2026. WebinarJam’s Active registrants page
              also shows 274, while its Analytics page shows 291. The
              discrepancy is within the source platform and needs provider
              clarification.
            </small>
          </div>
        </div>
      )}
      <ReportVisuals data={data} webinar={w} onSource={onSource} />
      <div className="report-metric-heading">
        <h3>Webinar conversion rates</h3>
        <span>Five metrics · one consistent definition</span>
      </div>
      <div className="report-kpi-cards">
        {cards.map(([name, value, formula, description], i) => (
          <button
            key={name}
            className={`report-kpi ${value === null ? "pending" : ""}`}
            onClick={openEditor}
            title={description}
          >
            <span className="report-kpi-top">
              <span>{String(i + 1).padStart(2, "0")}</span>
              <Info size={13} />
            </span>
            <span className="report-kpi-name">{name}</span>
            <strong>{pct(value)}</strong>
            <small>{formula}</small>
            <span className="report-kpi-track">
              {value !== null && (
                <i style={{ width: `${Math.min(value * 100, 100)}%` }} />
              )}
            </span>
            <span className="report-kpi-bottom">
              {value === null ? "Add missing inputs" : "View / edit inputs"}
              <ArrowUpRight size={12} />
            </span>
          </button>
        ))}
      </div>
      <div className="report-analysis-grid">
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>From registration to action</h2>
              <p>Audience retention, then the two conversion paths.</p>
            </div>
            <SelectControl
              className="chart-format"
              aria-label="Conversion chart format"
              value={chartView}
              onValueChange={(value) => setChartView(value as typeof chartView)}
            >
              <option value="Funnel">Funnel</option>
              <option value="Bars">Bar chart</option>
              <option value="Table">Data table</option>
            </SelectControl>
          </div>
          {chartView === "Funnel" ? (
            <>
              <div className="report-funnel-flow">
                {stages.map(([name, count, note], i) => (
                  <div className="report-stage" key={name}>
                    <span>{name}</span>
                    <strong>{count ?? "—"}</strong>
                    <div className="report-stage-track">
                      {count != null && (
                        <i
                          style={{
                            width: `${k.registrants ? Math.min((count / k.registrants) * 100, 100) : 0}%`,
                          }}
                        />
                      )}
                    </div>
                    <small>
                      {count == null ? "Awaiting session count" : note}
                    </small>
                    {i < 2 && (
                      <ArrowRight className="report-stage-arrow" size={15} />
                    )}
                  </div>
                ))}
              </div>
              <div className="report-branches">
                <div>
                  <span>Applications</span>
                  <strong>{w.application_count ?? "—"}</strong>
                  <small>Application = Yes</small>
                </div>
                <div>
                  <span>Calls booked</span>
                  <strong>{w.call_booked_count ?? "—"}</strong>
                  <small>
                    {w.applicant_booked_count ?? "—"} from applicants
                  </small>
                </div>
              </div>
            </>
          ) : chartView === "Bars" ? (
            <div
              className="conversion-bars"
              role="group"
              aria-label="Session audience and conversion counts"
            >
              {[
                ...stages.map(([name, count]) => ({ name, count })),
                { name: "Applicants", count: w.application_count },
                { name: "Calls booked", count: w.call_booked_count },
                {
                  name: "Applicants who booked",
                  count: w.applicant_booked_count,
                },
              ].map(({ name, count }, i) => (
                <div className="conversion-bar-row" key={name}>
                  <div>
                    <span>{name}</span>
                    <strong>{count ?? "—"}</strong>
                  </div>
                  <span
                    className={`conversion-bar-track ${count == null ? "unknown" : ""}`}
                  >
                    {count != null && (
                      <i
                        style={{
                          width: `${Math.min(100, (count / Math.max(k.registrants, w.peak_attendees || 0, w.pitch_attendees || 0, w.application_count || 0, w.call_booked_count || 0, w.applicant_booked_count || 0, 1)) * 100)}%`,
                          background: i < 3 ? "#ff5539" : "#71717a",
                        }}
                      />
                    )}
                  </span>
                  {count == null && <small>Missing session count</small>}
                </div>
              ))}
            </div>
          ) : (
            <div className="table-scroll conversion-data">
              <table>
                <thead>
                  <tr>
                    <th>Stage</th>
                    <th>People</th>
                    <th>Data</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ...stages.map(([name, count]) => ({ name, count })),
                    { name: "Applicants", count: w.application_count },
                    { name: "Calls booked", count: w.call_booked_count },
                    {
                      name: "Applicants who booked",
                      count: w.applicant_booked_count,
                    },
                  ].map(({ name, count }, i) => (
                    <tr key={name}>
                      <td>{name}</td>
                      <td>{count ?? "—"}</td>
                      <td>
                        {i === 0
                          ? "Synced"
                          : count == null
                            ? "Missing"
                            : "Saved"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="report-footnote">
            Applications and calls are separate paths from the pitch audience. A
            booked call does not imply an application.
          </p>
        </section>
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Where registrants came from</h2>
              <p>Top sources · first touch · select to see leads.</p>
            </div>
            <Users size={16} />
          </div>
          <div className="report-sources">
            {ranked.slice(0, 6).map(([source, count], i) => (
              <button key={source} onClick={() => onSource?.(source)}>
                <span className="report-source-line">
                  <span>
                    <i
                      style={{ background: i === 0 ? "#ff5539" : "#a1a1aa" }}
                    />
                    {source === "(not set)" ? "Unattributed" : source}
                  </span>
                  <strong>
                    {count}
                    <small>
                      {k.registrants
                        ? Math.round((count / k.registrants) * 100)
                        : 0}
                      %
                    </small>
                  </strong>
                </span>
                <span className="report-source-track">
                  <i
                    style={{
                      width: `${k.registrants ? (count / k.registrants) * 100 : 0}%`,
                    }}
                  />
                </span>
              </button>
            ))}
          </div>
          <div className="report-source-coverage">
            <span>Attribution coverage</span>
            <strong>
              {k.registrants
                ? Math.round((attributed / k.registrants) * 100)
                : 0}
              %
            </strong>
            <small>
              {attributed} of {k.registrants} registrants have a known source
            </small>
          </div>
        </section>
      </div>
      <section className="panel report-input-summary">
        <div className="panel-head">
          <div>
            <h2>Report inputs</h2>
            <p>See what is synced, what is entered, and what is missing.</p>
          </div>
          <div className="report-input-actions">
            {crm && (
              <button
                className="button"
                disabled={busy}
                onClick={syncApplicants}
              >
                <RefreshCw size={13} className={busy ? "spin" : ""} />
                Sync CRM data
              </button>
            )}
            <button className="button" onClick={openEditor}>
              <Pencil size={13} />
              Edit counts
            </button>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Input</th>
                <th>Count</th>
                <th>Source</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Registrants</td>
                <td>{k.registrants}</td>
                <td>WebinarJam API</td>
                <td>
                  <span className="input-state ready">
                    <CheckCircle2 size={12} />
                    Synced
                  </span>
                </td>
              </tr>
              {inputs.map(([key, name]) => (
                <tr key={key}>
                  <td>{name}</td>
                  <td>{w[key] ?? "—"}</td>
                  <td>
                    {(key === "application_count" && crm?.syncedAt) ||
                    (key.includes("booked") && crm?.bookingsSyncedAt)
                      ? key === "application_count"
                        ? "GHL · tagged cohort"
                        : "GHL · Advisory Call calendar"
                      : "Session entry"}
                  </td>
                  <td>
                    <span
                      className={`input-state ${w[key] == null ? "" : "ready"}`}
                    >
                      {w[key] == null ? (
                        <CircleDashed size={12} />
                      ) : (
                        <CheckCircle2 size={12} />
                      )}{" "}
                      {w[key] == null
                        ? "Missing"
                        : (key === "application_count" && crm?.syncedAt) ||
                            (key.includes("booked") && crm?.bookingsSyncedAt)
                          ? "Synced"
                          : "Entered"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="report-footnote">
          Missing values and zero denominators display —.{" "}
          {crm
            ? `Applicants use tag “${crm.tag}” + the current Application Submitted = Yes field. Earlier applications may qualify. ${crm.bookingsSyncedAt ? "Bookings use the Advisory Call calendar, exclude cancellations, and count each contact once. Bookings are attributed to the latest tagged session started before booking. Calendar coverage runs from the earlier of 90 days ago or the first session through 90 days ahead." : "Booking counts are manually entered until the first calendar sync."}`
            : "Session entries are not automatically sourced from GHL yet."}
          {w.kpi_updated_at
            ? ` Last updated ${new Date(w.kpi_updated_at).toLocaleString("en-GB", { timeZone: "UTC" })} UTC.`
            : ""}
        </p>
      </section>
      {editing && (
        <div className="overlay" onClick={() => !busy && setEditing(false)}>
          <section
            className="modal report-edit-modal"
            ref={editorRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-edit-title"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape" && !busy) setEditing(false);
              if (e.key === "Tab") {
                const items = editorRef.current?.querySelectorAll<HTMLElement>(
                  "button:not([disabled]), input:not([disabled])",
                );
                if (!items?.length) return;
                const first = items[0],
                  last = items[items.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                  e.preventDefault();
                  last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                  e.preventDefault();
                  first.focus();
                }
              }
            }}
          >
            <div className="modal-head">
              <div>
                <span className="report-kicker">SESSION INPUTS</span>
                <h2 id="report-edit-title">Complete your report</h2>
              </div>
              <button
                className="icon-button"
                aria-label="Close session editor"
                disabled={busy}
                onClick={() => setEditing(false)}
              >
                <X size={18} />
              </button>
            </div>
            <p className="muted">
              {w.name}. Enter counts for this session only. Leave unknown values
              blank.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              <div className="report-edit-grid">
                {inputs.map(([key, name, help], i) => (
                  <label key={key}>
                    <span>
                      <b>{String(i + 1).padStart(2, "0")}</b>
                      {name}
                    </span>
                    <input
                      autoFocus={i === 0}
                      disabled={
                        (key === "application_count" && Boolean(crm)) ||
                        (key.includes("booked") &&
                          Boolean(crm?.bookingsSyncedAt))
                      }
                      type="number"
                      min="0"
                      max="10000000"
                      step="1"
                      value={values[key]}
                      placeholder="Unknown"
                      onChange={(e) =>
                        setValues({ ...values, [key]: e.target.value })
                      }
                    />
                    <small>
                      {(key === "application_count" && crm) ||
                      (key.includes("booked") && crm?.bookingsSyncedAt)
                        ? "Synced from GHL. Use Sync CRM data to refresh."
                        : help}
                    </small>
                  </label>
                ))}
              </div>
              {message && (
                <p role="alert" className="error-banner">
                  {message}
                </p>
              )}
              <div className="report-edit-actions">
                <button
                  type="button"
                  className="button"
                  disabled={busy}
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </button>
                <button
                  className="button primary"
                  disabled={busy}
                  type="submit"
                >
                  <Check size={14} />
                  {busy ? "Saving…" : "Save & calculate rates"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {!editing && message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
    </>
  );
}
