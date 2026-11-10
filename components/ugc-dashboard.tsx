"use client";
import { useEffect, useRef, useState } from "react";
import {
  Layers,
  Video,
  RefreshCw,
  ExternalLink,
  Download,
  Users,
  CalendarDays,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { ClientSwitcher } from "./client-switcher";
import { SelectControl } from "./form-controls";
import { csv } from "../lib/reporting";
import type { UgcReport } from "../lib/ugc-report";
const pct = (value: number | null) =>
  value === null ? "—" : `${(value * 100).toFixed(1)}%`;
const date = (value: string) =>
  new Date(value).toLocaleString("en-GB", {
    timeZone: "Europe/Berlin",
    dateStyle: "medium",
    timeStyle: "short",
  });
export function UgcDashboard({
  initial,
  error: initialError,
}: {
  initial: UgcReport | null;
  error: string | null;
}) {
  const [report, setReport] = useState(initial),
    [error, setError] = useState(initialError),
    [selected, setSelected] = useState(initial?.sessions.at(-1)?.id || ""),
    [busy, setBusy] = useState(false);
  const inFlight = useRef(false),
    controller = useRef<AbortController | null>(null);
  async function refresh(manual = false) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    const abort = new AbortController();
    controller.current = abort;
    try {
      const r = await fetch("/api/ugc/report", {
        method: manual ? "POST" : "GET",
        cache: "no-store",
        signal: abort.signal,
      });
      const body = await r.json();
      if (!r.ok) throw Error(body.error || "UGC refresh failed.");
      if (body.client !== "ugc") throw Error("Unexpected client response.");
      setReport(body);
      setError(null);
    } catch (e) {
      if (!abort.signal.aborted)
        setError(e instanceof Error ? e.message : "Refresh failed.");
    } finally {
      inFlight.current = false;
      if (!abort.signal.aborted) setBusy(false);
    }
  }
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh(true);
    }, 60000);
    return () => {
      clearInterval(timer);
      controller.current?.abort();
    };
  }, []);
  const session =
    report?.sessions.find((s) => s.id === selected) || report?.sessions.at(-1);
  function exportCsv() {
    if (!session) return;
    const blob = new Blob(
      [
        csv([
          {
            client: "UGC Queen",
            session: session.code,
            name: session.name,
            start: session.startsAt,
            registrants: session.registrants,
            booked_contacts: session.bookedContacts,
            attendee_bookings: session.attendeeBookings,
            call_booked_rate: pct(session.bookingRate),
            live_attendees: session.liveAttendees,
            peak: session.peak,
            pitch: session.pitch,
            attendance_rate: pct(session.attendanceRate),
            retention_rate: pct(session.retentionRate),
          },
        ]),
      ],
      { type: "text/csv;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = `${session.code}-report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="app-shell ugc-shell">
      <aside className="sidebar">
        <a className="brand" href="/ugc">
          <span className="brand-mark">
            <Layers size={19} />
          </span>
          <span>
            UGC Queen<span className="brand-caption">WEBINAR INTELLIGENCE</span>
          </span>
        </a>
        <ClientSwitcher client="ugc" />
        <div className="nav-label">WORKSPACE</div>
        <nav>
          <a className="nav-item active" href="/ugc">
            <Video size={17} />
            <span>Webinar reports</span>
          </a>
        </nav>
        <div className="sidebar-bottom">
          <span className="mode-label">
            <i className="status-dot" />
            UGC Queen workspace
          </span>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span>›</span>
            <strong>UGC Queen</strong>
          </div>
          <span className="mode-label">
            {busy
              ? "Refreshing…"
              : report && !error
                ? "Connected data"
                : "Needs attention"}
          </span>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <h1>Webinar performance</h1>
              <p>UGC Queen · Bianca</p>
            </div>
            <div className="ugc-actions">
              <button
                className="button secondary"
                onClick={exportCsv}
                disabled={!session}
              >
                <Download size={14} />
                Export CSV
              </button>
              <button
                className="button primary"
                disabled={busy}
                onClick={() => void refresh(true)}
              >
                <RefreshCw size={14} />
                {busy ? "Refreshing…" : "Refresh data"}
              </button>
            </div>
          </div>
          {error && (
            <p className="error-banner" role="alert">
              {error}
              {report ? " Previously loaded figures are shown below." : ""}
            </p>
          )}
          {!session ? (
            <section className="panel">
              <div className="panel-head">
                <h2>Connect UGC reporting</h2>
                <p>
                  Check the UGC account credentials and the Client Events row,
                  then refresh.
                </p>
              </div>
            </section>
          ) : (
            <>
              <section className="ugc-session panel">
                <div className="ugc-session-top">
                  <div>
                    <span className="eyebrow">{session.code}</span>
                    <h2>{session.name}</h2>
                    <p>
                      <CalendarDays size={14} />
                      {date(session.startsAt)} · Berlin
                    </p>
                  </div>
                  <SelectControl
                    aria-label="Webinar session"
                    value={session.id}
                    onValueChange={setSelected}
                  >
                    {report!.sessions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code} · {date(s.startsAt)} · {s.name}
                      </option>
                    ))}
                  </SelectControl>
                </div>
                {session.notionUrl && (
                  <a
                    className="button secondary"
                    href={session.notionUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open in Notion
                    <ExternalLink size={13} />
                  </a>
                )}
              </section>
              {session.issues.length > 0 && (
                <p className="error-banner" role="alert">
                  {session.issues.join(" ")}
                </p>
              )}
              <div className="ugc-kpis">
                {[
                  ["Registrants", session.registrants],
                  ["Live attendees", session.liveAttendees],
                  ["Booked contacts", session.bookedContacts],
                  ["Peak audience", session.peak],
                  ["People at pitch", session.pitch],
                ].map(([label, value]) => (
                  <section className="panel ugc-kpi" key={label}>
                    <span>{label}</span>
                    <strong>{value ?? "—"}</strong>
                  </section>
                ))}
              </div>
              <div className="report-metric-heading"><h3>Webinar conversion rates</h3></div>
              <div className="ugc-rates">
                <section className="panel ugc-kpi">
                  <span>Attendance rate</span>
                  <strong>{pct(session.attendanceRate)}</strong>
                  <small>
                    {session.peak ?? "—"} peak / {session.registrants}{" "}
                    registrants
                  </small>
                </section>
                <section className="panel ugc-kpi">
                  <span>Retention rate</span>
                  <strong>{pct(session.retentionRate)}</strong>
                  <small>
                    {session.pitch ?? "—"} at pitch / {session.peak ?? "—"} peak
                  </small>
                </section>
                <section className="panel ugc-kpi">
                  <span>Call booked rate</span>
                  <strong>{pct(session.bookingRate)}</strong>
                  <small>{session.attendeeBookings ?? "—"} live attendee bookings / {session.pitch ?? "—"} at pitch</small>
                </section>
                <section className="panel ugc-kpi">
                  <span>Applicant-to-booking rate</span>
                  <strong>—</strong>
                  <small>Applicant tracking is unavailable</small>
                </section>
              </div>
              <div className="ugc-analysis">
                <section className="panel">
                  <div className="panel-head">
                    <h3>Registration activity</h3>
                  </div>
                  <div className="ugc-chart">
                    {session.registrationDays.length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={session.registrationDays}>
                          <CartesianGrid vertical={false} stroke="#eeeef1" />
                          <XAxis
                            dataKey="date"
                            tickFormatter={(v) =>
                              new Date(`${v}T12:00:00Z`).toLocaleDateString(
                                "en-GB",
                                {
                                  day: "numeric",
                                  month: "short",
                                  timeZone: "UTC",
                                },
                              )
                            }
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            allowDecimals={false}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip />
                          <Bar
                            dataKey="count"
                            name="Registrants"
                            fill="#ff5539"
                            radius={[3, 3, 0, 0]}
                            maxBarSize={42}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <p>No registrations yet.</p>
                    )}
                  </div>
                </section>
                <section className="panel">
                  <div className="panel-head">
                    <h3>Registration sources</h3>
                    <Users size={16} />
                  </div>
                  <div className="ugc-sources">
                    {session.sources.map((s) => (
                      <div key={s.name}>
                        <div>
                          <span>{s.name}</span>
                          <strong>{s.count}</strong>
                          <small>{pct(s.count / session.registrants)}</small>
                        </div>
                        <div className="ugc-source-track">
                          <i
                            style={{
                              width: `${(100 * s.count) / session.registrants}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                    {!session.sources.length && <p>No source data yet.</p>}
                  </div>
                </section>
              </div>
              <details className="panel ugc-connections">
                <summary>Connections & data</summary>
                <div>
                  <p>
                    WebinarJam: {session.registrationRecords} registration
                    records · {session.registrants} unique people.
                  </p>
                  <p>
                    GHL: {session.crmMatched} registrants matched ·{" "}
                    {session.crmUnmatched} unmatched or ambiguous.
                  </p>
                  <p>Notion: peak, pitch and session timing.</p>
                  <p>Booked contacts use the GHL Appointment Booked flag for matched webinar registrants.</p>
                </div>
              </details>
            </>
          )}
          <footer>
            <span>UGC Queen · Webinar Intelligence</span>
            <span>
              {report
                ? `Updated ${date(report.checkedAt)} · refreshes every minute`
                : ""}
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
