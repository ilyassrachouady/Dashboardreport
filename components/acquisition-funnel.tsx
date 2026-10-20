"use client";

import { useMemo, useState } from "react";
import type { Dataset } from "../lib/model";
import { defaultFilters } from "../lib/model";
import { dimensions } from "../lib/reporting";
import { reportingPayments } from "../lib/payment-history";
import { isBooked } from "../lib/integrations/ghl-bookings";
import { SelectControl } from "./form-controls";

function usd(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function pct(n: number, d: number) {
  return d ? `${((n / d) * 100).toFixed(1)}%` : "—";
}

export function AcquisitionFunnel({ data }: { data: Dataset }) {
  const [model, setModel] = useState<"first" | "last">("first");
  const rows = useMemo(() => {
    const f = { ...defaultFilters, model };
    const payments = reportingPayments(data).filter(
      (p) => p.status === "succeeded" && Boolean(p.sale_id),
    );
    const groups = new Map<string, Set<string>>();

    for (const contact of data.contacts) {
      const source = dimensions(data, contact.id, f).source;
      if (!groups.has(source)) groups.set(source, new Set());
      groups.get(source)!.add(contact.id);
    }

    return [...groups.entries()]
      .map(([source, ids]) => {
        const registrations = data.registrations.filter((r) => ids.has(r.contact_id)).length;
        const booked = data.appointments.filter(
          (a) => ids.has(a.contact_id) && isBooked(a.status),
        ).length;
        const attendedCalls = data.calls.filter(
          (c) => ids.has(c.contact_id) && c.attendance === "attended",
        );
        const callIds = new Set(attendedCalls.map((c) => c.id));
        const sales = data.sales.filter(
          (s) => ids.has(s.contact_id) && Boolean(s.sales_call_id && callIds.has(s.sales_call_id)),
        );
        const saleIds = new Set(sales.map((s) => s.id));
        const cash = payments
          .filter((p) => p.sale_id && saleIds.has(p.sale_id))
          .reduce((sum, p) => sum + p.amount, 0);
        return {
          source,
          registrations,
          booked,
          attended: attendedCalls.length,
          sales: sales.length,
          cash,
        };
      })
      .filter((r) => r.registrations || r.booked || r.attended || r.sales || r.cash)
      .sort((a, b) => b.cash - a.cash || b.registrations - a.registrations);
  }, [data, model]);

  const totals = rows.reduce(
    (a, r) => ({
      registrations: a.registrations + r.registrations,
      booked: a.booked + r.booked,
      attended: a.attended + r.attended,
      sales: a.sales + r.sales,
      cash: a.cash + r.cash,
    }),
    { registrations: 0, booked: 0, attended: 0, sales: 0, cash: 0 },
  );

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Source → revenue funnel</h2>
          <p>
            End-to-end attribution from webinar registration through booked call,
            attended call, recorded sale and verified sale-linked USD receipts.
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
          <div className="kpi-value">{totals.registrations.toLocaleString()}</div>
          <div className="kpi-detail">Imported registration records</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Booked calls</div>
          <div className="kpi-value">{totals.booked.toLocaleString()}</div>
          <div className="kpi-detail">{pct(totals.booked, totals.registrations)} of registrations</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Attended calls</div>
          <div className="kpi-value">{totals.attended.toLocaleString()}</div>
          <div className="kpi-detail">{pct(totals.attended, totals.booked)} of booked calls</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Recorded sales</div>
          <div className="kpi-value">{totals.sales.toLocaleString()}</div>
          <div className="kpi-detail">{pct(totals.sales, totals.attended)} of attended calls</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Attributed cash</div>
          <div className="kpi-value">{usd(totals.cash)}</div>
          <div className="kpi-detail">Verified sale-linked USD receipts only</div>
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
              <th>Reg → booked</th>
              <th>Booked → attended</th>
              <th>Attended → sale</th>
              <th>Attributed cash</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.source}>
                <td>{row.source === "(not set)" ? "Unattributed" : row.source}</td>
                <td>{row.registrations}</td>
                <td>{row.booked}</td>
                <td>{row.attended}</td>
                <td>{row.sales}</td>
                <td>{pct(row.booked, row.registrations)}</td>
                <td>{pct(row.attended, row.booked)}</td>
                <td>{pct(row.sales, row.attended)}</td>
                <td>{usd(row.cash)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && <div className="revenue-trend-empty">No attributed funnel activity yet.</div>}
      <p className="revenue-trend-note">
        Unmatched Whop receipts are excluded. A sale only enters this funnel when it
        is linked to an attended recorded sales call, so incomplete Payment Desk call
        history can understate conversion rates.
      </p>
    </section>
  );
}
