"use client";
import { MetricHelp } from "./metric-help";
import { useState } from "react";
import type { Dataset } from "../lib/model";
import { attendanceStatuses, crmAttendanceRows } from "../lib/crm-attendance";
export function CrmAttendance({ data }: { data: Dataset }) {
  const [filter, setFilter] = useState("All");
  const rows = crmAttendanceRows(data),
    filtered = rows.filter((r) => filter === "All" || r.status === filter);
  const available = !!data.crmAttendance && !data.crmAttendanceError;
  return (
    <section className="panel crm-attendance">
      <div className="panel-head">
        <div>
          <h2>Attendance · GHL</h2>
          <MetricHelp label="Attendance scope">Current contact status in GHL. Company-wide; date and webinar filters do not apply.</MetricHelp>
        </div>
        <button className="secondary" onClick={() => setFilter("All")}>
          Show all contacts
        </button>
      </div>
      {data.crmAttendanceError && (
        <p className="error-banner">{data.crmAttendanceError}</p>
      )}
      <div className="kpi-grid">
        {attendanceStatuses.slice(0, 4).map((status) => (
          <button
            key={status}
            className="kpi"
            aria-pressed={filter === status}
            onClick={() => setFilter(status)}
          >
            <div className="kpi-label">{status}</div>
            <div className="kpi-value">
              {available ? rows.filter((r) => r.status === status).length : "—"}
            </div>

          </button>
        ))}
      </div>
      {available && (
        <>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Contact</th>
                  <th>Email</th>
                  <th>CRM attendance</th>
                  <th>GHL</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.ghl_contact_id}>
                    <td>
                      {r.contact
                        ? `${r.contact.first_name} ${r.contact.last_name}`
                        : "CRM contact"}
                    </td>
                    <td>{r.contact?.email || "Not available"}</td>
                    <td>{r.status === "Unrecognised" ? r.value : r.status}</td>
                    <td>
                      <a
                        target="_blank"
                        rel="noreferrer"
                        href={`https://app.gohighlevel.com/v2/location/WgeDf11I8yBah6LRzZL1/contacts/detail/${encodeURIComponent(r.ghl_contact_id)}`}
                      >
                        Open contact ↗
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!filtered.length && (
            <p className="revenue-trend-empty">
              No contacts match this attendance status.
            </p>
          )}
        </>
      )}
      <p className="revenue-trend-note">
        {rows.length} populated contact fields ·{" "}
        {rows.filter((r) => r.status === "Unrecognised").length} unrecognised
        values · Blank fields excluded. Each contact counts once; these are
        latest statuses, not historical appointment totals. Click a status card
        to filter. Reads directly from GHL on each 15-second live refresh while
        this tab is visible.
      </p>
    </section>
  );
}
