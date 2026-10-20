"use client";
import { useState } from "react";
import type { Dataset } from "../lib/model";
import { matchedContact } from "../lib/payment-history";
import { salesPerformance } from "../lib/sales-performance";
import { SelectControl } from "./form-controls";
import { AcquisitionFunnel } from "./acquisition-funnel";

function usd(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function percent(value: number | null) {
  return value === null ? "—" : `${(value * 100).toFixed(1)}%`;
}

export function WhopPaymentHistory({ data }: { data: Dataset }) {
  const [currency, setCurrency] = useState("USD"),
    [status, setStatus] = useState("succeeded");
  const rows = (data.whopPayments || []).filter(
    (p) =>
      (currency === "all" || p.currency === currency) &&
      (status === "all" || p.status === status),
  );
  const currencies = [
    ...new Set(data.whopPayments?.map((p) => p.currency) || []),
  ];
  const performance = salesPerformance(data);

  return (
    <>
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Closer & payment performance</h2>
            <p>
              Verified Payment Desk call, agreement and receipt data. PIF counts
              only a PIF agreement with one successful payment covering the full
              contract value.
            </p>
          </div>
        </div>
        <div className="kpi-grid">
          <div className="kpi">
            <div className="kpi-label">Attended sales calls</div>
            <div className="kpi-value">{performance.attended.toLocaleString()}</div>
            <div className="kpi-detail">Recorded Payment Desk calls</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Recorded agreements</div>
            <div className="kpi-value">{performance.sales.toLocaleString()}</div>
            <div className="kpi-detail">Closed-sale records</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Verified PIF rate</div>
            <div className="kpi-value">{percent(performance.pifRate)}</div>
            <div className="kpi-detail">
              {performance.verifiedPif} verified PIF / {performance.sales} agreements
            </div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Cash per attended call</div>
            <div className="kpi-value">
              {performance.cashPerAttendedCall === null
                ? "—"
                : usd(performance.cashPerAttendedCall)}
            </div>
            <div className="kpi-detail">Sale-linked successful USD receipts</div>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Closer</th>
                <th>Attended calls</th>
                <th>Sales</th>
                <th>Close rate</th>
                <th>Verified PIF</th>
                <th>PIF rate</th>
                <th>Contract value</th>
                <th>Cash collected</th>
                <th>Cash / attended call</th>
              </tr>
            </thead>
            <tbody>
              {performance.closers.map((closer) => (
                <tr key={closer.closer}>
                  <td>{closer.closer}</td>
                  <td>{closer.attended}</td>
                  <td>{closer.sales}</td>
                  <td>{percent(closer.closeRate)}</td>
                  <td>{closer.verifiedPif}</td>
                  <td>{percent(closer.pifRate)}</td>
                  <td>{usd(closer.contract)}</td>
                  <td>{usd(closer.cash)}</td>
                  <td>
                    {closer.cashPerAttendedCall === null
                      ? "—"
                      : usd(closer.cashPerAttendedCall)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!performance.closers.length && (
          <div className="revenue-trend-empty">No recorded closer activity yet.</div>
        )}
        <p className="revenue-trend-note">
          Closer metrics use only agreements linked to recorded calls and
          successful sale-linked USD receipts. Current Payment Desk history is
          incomplete and includes test activity, so this is operational reporting,
          not a compensation statement.
        </p>
      </section>

      <AcquisitionFunnel data={data} />

      <section className="panel whop-history">
        <div className="panel-head">
          <div>
            <h2>Whop payment history</h2>
            <p>
              Live company-wide transactions from Whop, including payments outside
              Payment Desk. These are payment events, not additional sale
              agreements.
            </p>
          </div>
          <div className="revenue-trend-controls">
            <SelectControl
              aria-label="Payment currency"
              value={currency}
              onValueChange={setCurrency}
            >
              <option value="all">All currencies</option>
              {["USD", ...currencies.filter((c) => c !== "USD")].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </SelectControl>
            <SelectControl
              aria-label="Payment status"
              value={status}
              onValueChange={setStatus}
            >
              <option value="succeeded">Successful payments</option>
              <option value="failed">Failed / blocked</option>
              <option value="refunded">Refunded</option>
              <option value="all">All attempts</option>
            </SelectControl>
          </div>
        </div>
        {data.whopHistoryError ? (
          <p className="error-banner">{data.whopHistoryError}</p>
        ) : (
          <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Payment date (UTC)</th>
                    <th>Customer</th>
                    <th>Status</th>
                    <th>Amount</th>
                    <th>Refunded</th>
                    <th>CRM match</th>
                    <th>Whop reference</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => {
                    const c = matchedContact(data, p);
                    const format = (n: number) =>
                      new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: p.currency,
                      }).format(n / 10 ** p.decimals);
                    return (
                      <tr key={p.id}>
                        <td>
                          {new Date(p.paid_at || p.created_at).toLocaleString(
                            "en-GB",
                            { timeZone: "UTC" },
                          )}
                        </td>
                        <td>{p.customer_name}</td>
                        <td>
                          <span
                            className={`input-state ${p.status === "succeeded" ? "ready" : ""}`}
                          >
                            {p.status === "succeeded" ? "Paid" : p.status}
                          </span>
                        </td>
                        <td>
                          {p.currency} {format(p.amount)}
                        </td>
                        <td>{format(p.refunded)}</td>
                        <td>
                          {c ? `${c.first_name} ${c.last_name}` : "Not linked"}
                        </td>
                        <td>
                          <code>{p.id}</code>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!rows.length && (
              <div className="revenue-trend-empty">
                No matching Whop payments.
              </div>
            )}
            <p className="revenue-trend-note">
              {rows.length} transactions · Company-wide history has its own
              currency/status filters · Unmatched customers are not assigned a
              source or closer · USD and CAD are never combined.
            </p>
          </>
        )}
      </section>
    </>
  );
}
