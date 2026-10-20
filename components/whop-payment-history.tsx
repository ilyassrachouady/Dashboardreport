"use client";
import { useState } from "react";
import type { Dataset } from "../lib/model";
import { matchedContact } from "../lib/payment-history";
import { SelectControl } from "./form-controls";
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
  return (
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
  );
}
