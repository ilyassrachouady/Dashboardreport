"use client";
import { MetricHelp } from "./metric-help";
import type { Dataset } from "../lib/model";
import { crmPerformance } from "../lib/crm-performance";
import { PaymentWorkspace } from "./payment-workspace";
import { AcquisitionFunnel } from "./acquisition-funnel";
import { CrmAttendance } from "./crm-attendance";
const usd = (cents: number | null) =>
  cents === null
    ? "—"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
      }).format(cents / 100);
const percent = (value: number | null) =>
  value === null ? "—" : `${(value * 100).toFixed(1)}%`;
export function WhopPaymentHistory({ data }: { data: Dataset }) {
  const p = crmPerformance(data),
    available =
      data.crmCallSnapshots !== undefined &&
      !data.crmStructuresError &&
      !data.crmSnapshotError;
  return (
    <div className="sales-payment-workspace">
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Closer & payment performance · GHL</h2>
            <MetricHelp label="CRM reporting scope">
              Current GHL contact fields only: Attendance, Call Outcome, Closer,
              Payment Structure, Agreed Total Investment and Cash Collected.
            </MetricHelp>
          </div>
        </div>
        <div className="kpi-grid">
          <div className="kpi">
            <div className="kpi-label">Show-up rate</div>
            <div className="kpi-value">{available ? percent(p.showRate) : "—"}</div>
            <MetricHelp>{p.attended} attended / {p.finalized} finalized attendance records. Excludes cancelled, rescheduled and blank attendance. Current GHL contact fields; each contact counts once.</MetricHelp>
          </div>
          <div className="kpi">
            <div className="kpi-label">Attended contacts</div>
            <div className="kpi-value">{available ? p.attended : "—"}</div>
            <MetricHelp>GHL Attendance = Attended</MetricHelp>
          </div>
          <div className="kpi">
            <div className="kpi-label">Sold contacts</div>
            <div className="kpi-value">{available ? p.sold : "—"}</div>
            <MetricHelp>GHL Call Outcome = Sold</MetricHelp>
          </div>
          <div className="kpi">
            <div className="kpi-label">PIF share · CRM</div>
            <div className="kpi-value">
              {available ? percent(p.pifRate) : "—"}
            </div>
            <MetricHelp>
              {p.pif} PIF / {p.classified} contacts with a recognised Payment
              Structure
            </MetricHelp>
          </div>
          <div className="kpi">
            <div className="kpi-label">Cash collected · GHL</div>
            <div className="kpi-value">
              {available ? usd(p.cash) : "—"}
            </div>
            <MetricHelp>
              Sum of GHL Cash Collected · includes first instalments
            </MetricHelp>
          </div>
        </div>
        {available ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>GHL closer</th>
                  <th>Attended contacts</th>
                  <th>Sold contacts</th>
                  <th>Show-up rate</th>
                  <th>Close rate</th>
                  <th>PIF</th>
                  <th>Manual plans</th>
                  <th>Financing</th>
                  <th>PIF share</th>
                  <th>Missing plan on sold contacts</th>
                  <th>Agreed investment</th>
                  <th>CRM-reported cash</th>
                </tr>
              </thead>
              <tbody>
                {p.closers.map((c) => (
                  <tr key={c.closer}>
                    <td>{c.closer}</td>
                    <td>{c.attended}</td>
                    <td>{c.sold}</td>
                    <td>{percent(c.showRate)}</td>
                    <td>{percent(c.closeRate)}</td>
                    <td>{c.pif}</td>
                    <td>{c.manual}</td>
                    <td>{c.financing}</td>
                    <td>{percent(c.pifRate)}</td>
                    <td>{c.missingPlans}</td>
                    <td>{usd(c.contract)}</td>
                    <td>{usd(c.cash)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="error-banner">
            {data.crmSnapshotError ||
              data.crmStructuresError ||
              "GHL reporting fields have not been loaded."}
          </p>
        )}
        <details className="reporting-details"><summary>Reporting details</summary><div>
          Each contact counts once, under the Closer field in GHL; a missing
          closer stays Unassigned. PIF share = PIF / (PIF + Manual Payment Plan
          + Financing). Missing or unrecognised structures are excluded, not
          guessed. Close rate = Sold-and-Attended contacts / Attended contacts.
          Cash is the amount entered in GHL Cash Collected, including first payments on plans; it is not the full agreed investment or a separate verified receipt total. Initial payments are not added a second time. Current contact snapshots are independent of report date/webinar
          filters and do not represent historical call counts. Whop receipts do
          not determine any CRM classification.
        </div></details>
        {available && p.missingPlans > 0 && (
          <details className="reporting-details"><summary>Reporting details</summary><div>
            {p.missingPlans} sold contacts have no recognised Payment Structure
            in GHL. Fill that field to include them in the PIF/manual/financing
            mix.
          </div></details>
        )}
      </section>
      <CrmAttendance data={data} />
      <AcquisitionFunnel data={data} />
      <PaymentWorkspace data={data} />
    </div>
  );
}
