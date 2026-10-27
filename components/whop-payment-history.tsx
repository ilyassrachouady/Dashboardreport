"use client";
import { MetricHelp } from "./metric-help";
import type { Filters, Dataset } from "../lib/model";
import { selectContacts } from "../lib/reporting";
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
export function WhopPaymentHistory({ data, filters }: { data: Dataset; filters?: Filters }) {
  const p = crmPerformance(data, filters),
    available =
      data.crmCallSnapshots !== undefined &&
      !data.crmStructuresError &&
      !data.crmSnapshotError;
  const hasFilters=filters && Object.entries(filters).some(([key,value])=>key!=="model" && Boolean(value));
  const scopeIds=hasFilters ? new Set(selectContacts(data,{...filters!,closer:""}).map(c=>c.ghl_contact_id)) : null;
  const selectedSnapshots=data.crmCallSnapshots?.filter(r=>(!scopeIds || scopeIds.has(r.ghl_contact_id)) && (!filters?.closer || r.closer===filters.closer));
  const selectedIds=new Set(selectedSnapshots?.map(r=>r.ghl_contact_id));
  const attendanceData=hasFilters ? {...data,crmAttendance:data.crmAttendance?.filter(r=>selectedIds.has(r.ghl_contact_id))} : data;
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
          {([["AOV",p.aov,"GHL Cash Collected / Sold contacts"],["Cash per Call",p.cashPerCall,"GHL Cash Collected / Attended contacts"]] as const).map(([label,value,help])=><div className="kpi" key={label}><div className="kpi-label">{label}</div><div className="kpi-value">{available ? usd(value) : "—"}</div><MetricHelp>{help}. Same selected acquisition cohort; current CRM contact snapshots. Includes first instalments once.</MetricHelp></div>)}
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
                  <th>AOV</th><th>Cash per Call</th>
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
                    <td>{usd(c.aov)}</td><td>{usd(c.cashPerCall)}</td>
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
          Cash is the amount entered in GHL Cash Collected, including first payments on plans; it is not the full agreed investment or a separate verified receipt total. Initial payments are not added a second time. Current contact snapshots follow the selected acquisition cohort and do not represent historical repeat-call counts. Whop receipts do
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
      <CrmAttendance data={attendanceData} scoped={Boolean(hasFilters)} />
      <AcquisitionFunnel data={data} />
      <PaymentWorkspace data={data} />
    </div>
  );
}
