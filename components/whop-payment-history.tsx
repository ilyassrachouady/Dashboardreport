"use client";
import type { Dataset } from "../lib/model";
import { salesPerformance } from "../lib/sales-performance";
import { PaymentWorkspace } from "./payment-workspace";
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
            <div className="kpi-value">
              {performance.attended.toLocaleString()}
            </div>
            <div className="kpi-detail">Recorded Payment Desk calls</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Recorded agreements</div>
            <div className="kpi-value">
              {performance.sales.toLocaleString()}
            </div>
            <div className="kpi-detail">Closed-sale records</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Verified PIF rate</div>
            <div className="kpi-value">{percent(performance.pifRate)}</div>
            <div className="kpi-detail">
              {performance.verifiedPif} verified PIF / {performance.sales}{" "}
              agreements
            </div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Cash per attended call</div>
            <div className="kpi-value">
              {performance.cashPerAttendedCall === null
                ? "—"
                : usd(performance.cashPerAttendedCall)}
            </div>
            <div className="kpi-detail">
              Sale-linked successful USD receipts
            </div>
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
          <div className="revenue-trend-empty">
            No recorded closer activity yet.
          </div>
        )}
        <p className="revenue-trend-note">
          Closer metrics use only agreements linked to recorded calls and
          successful sale-linked USD receipts. Current Payment Desk history is
          incomplete and includes test activity, so this is operational
          reporting, not a compensation statement.
        </p>
      </section>

      <AcquisitionFunnel data={data} />

      <PaymentWorkspace data={data} />
    </>
  );
}
