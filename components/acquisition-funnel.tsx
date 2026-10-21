"use client";

import { useMemo, useState } from "react";
import type { Dataset } from "../lib/model";
import { defaultFilters } from "../lib/model";
import { dimensions } from "../lib/reporting";
import { crmCloserCash } from "../lib/crm-cash";
import { isBooked } from "../lib/integrations/ghl-bookings";
import { SelectControl } from "./form-controls";

function usd(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}


export function AcquisitionFunnel({ data }: { data: Dataset }) {
  const [model, setModel] = useState<"first" | "last">("first");
  const rows = useMemo(() => {
    const f = { ...defaultFilters, model };
    const crm = crmCloserCash(data);
    const groups = new Map<string, Set<string>>();

    for (const contact of data.contacts) {
      const source = dimensions(data, contact.id, f).source;
      if (!groups.has(source)) groups.set(source, new Set());
      groups.get(source)!.add(contact.id);
    }

    return [...groups.entries()]
      .map(([source, ids]) => {
        const registrations = data.registrations.filter((r) =>
          ids.has(r.contact_id),
        ).length;
        const booked = data.appointments.filter(
          (a) => ids.has(a.contact_id) && isBooked(a.status),
        ).length;
        const attendedCalls = data.calls.filter(
          (c) => ids.has(c.contact_id) && c.attendance === "attended",
        );
        const callIds = new Set(attendedCalls.map((c) => c.id));
        const sales = data.sales.filter(
          (s) =>
            ids.has(s.contact_id) &&
            Boolean(s.sales_call_id && callIds.has(s.sales_call_id)),
        );
        const cashRows = crm.entries.filter((e) => ids.has(e.contactId));
        const cash = cashRows.length
          ? cashRows.reduce((sum, e) => sum + e.cash, 0)
          : null;
        return {
          source,
          registrations,
          booked,
          attended: attendedCalls.length,
          sales: sales.length,
          cash,
        };
      })
      .filter(
        (r) => r.registrations || r.booked || r.attended || r.sales || r.cash,
      )
      .sort(
        (a, b) =>
          (b.cash || 0) - (a.cash || 0) || b.registrations - a.registrations,
      );
  }, [data, model]);

  const totals = rows.reduce(
    (a, r) => ({
      registrations: a.registrations + r.registrations,
      booked: a.booked + r.booked,
      attended: a.attended + r.attended,
      sales: a.sales + r.sales,
      cash: a.cash + (r.cash || 0),
    }),
    { registrations: 0, booked: 0, attended: 0, sales: 0, cash: 0 },
  );

  return (
    <section className="panel sales-acquisition-funnel">
      <div className="panel-head">
        <div>
          <h2>Activity by acquisition source</h2>
          <p>
            Imported registration, appointment and Payment Desk records alongside current GHL Cash Collected. These are separate activity totals, not one conversion cohort.
          </p>
        </div>
        <SelectControl
          aria-label="Funnel attribution model"
          value={model}
          onValueChange={(value) => setModel(value as "first" | "last")}
        >
          <option value="first">First-touch source</option>
          <option value="last">Last-touch source</option>
        </SelectControl>
      </div>

      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi-label">Registrations</div>
          <div className="kpi-value">
            {totals.registrations.toLocaleString()}
          </div>
          <div className="kpi-detail">Imported registration records</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Booked calls</div>
          <div className="kpi-value">{totals.booked.toLocaleString()}</div>
          <div className="kpi-detail">
            Calendar appointment records
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Attended calls</div>
          <div className="kpi-value">{totals.attended.toLocaleString()}</div>
          <div className="kpi-detail">
            Payment Desk records · incomplete history
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Recorded sales</div>
          <div className="kpi-value">{totals.sales.toLocaleString()}</div>
          <div className="kpi-detail">
            Agreements linked to recorded attended calls
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">CRM-reported cash</div>
          <div className="kpi-value">
            {crmCloserCash(data).contacts ? usd(totals.cash) : "—"}
          </div>
          <div className="kpi-detail">
            GHL Cash Collected · unique linked contacts
          </div>
        </div>
      </div>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Source</th>
              <th>Registrations</th>
              <th>Booked</th>
              <th>Attended</th>
              <th>Sales</th>
              <th>CRM-reported cash</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.source}>
                <td>
                  {row.source === "(not set)" ? "Unattributed" : row.source}
                </td>
                <td>{row.registrations}</td>
                <td>{row.booked}</td>
                <td>{row.attended}</td>
                <td>{row.sales}</td>
                <td>{row.cash === null ? "—" : usd(row.cash)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && (
        <div className="revenue-trend-empty">
          No attributed funnel activity yet.
        </div>
      )}
      <p className="revenue-trend-note">
        Cash uses current GHL values once per linked contact, grouped by
        normalized source; it is not a historical Whop receipt total. A sale
        only enters this funnel when it is linked to an attended recorded sales
        call, so incomplete Payment Desk call history can understate conversion
        counts. Conversion percentages are omitted because these records do not establish a shared session or time cohort.
      </p>
    </section>
  );
}
