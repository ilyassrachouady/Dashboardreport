import type { Dataset } from "../lib/model";
const usd = (amount: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    Number(amount),
  );
export function WhopBalance({ data }: { data: Dataset }) {
  const b = data.whopBalance;
  return (
    <section className="panel whop-balance">
      <div className="panel-head">
        <div>
          <div className="eyebrow">Direct from Whop</div>
          <h2>Total account balance</h2>
          <p>
            Current account holdings, including available, pending and reserved
            funds. Independent of report filters.
          </p>
        </div>
        <span className="input-state">
          {data.whopBalanceError ? "Refresh failed" : "30-second refresh"}
        </span>
      </div>
      <div className="whop-balance-main">
        <strong>{b ? usd(b.totalUsd) : "Unavailable"}</strong>
        <span>USD · Whop’s own conversion</span>
      </div>
      {data.whopBalanceError && (
        <p className="error-banner">
          {data.whopBalanceError}
          {b ? " · Showing the last successful balance snapshot." : ""}
        </p>
      )}
      {b && (
        <>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Currency</th>
                  <th>Total held</th>
                  <th>Available</th>
                  <th>Pending</th>
                  <th>Reserved</th>
                  <th>Whop USD value</th>
                </tr>
              </thead>
              <tbody>
                {b.currencies.map((c) => (
                  <tr key={c.currency}>
                    <td>{c.currency}</td>
                    <td>{c.balance}</td>
                    <td>{c.available}</td>
                    <td>{c.pending}</td>
                    <td>{c.reserve}</td>
                    <td>
                      {c.valueUsd === null ? "Unavailable" : usd(c.valueUsd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="revenue-trend-note">
            Checked {new Date(b.fetchedAt).toLocaleString("en-GB")} · Updates
            while this tab is visible and when you return. Exchange rates can
            change the USD total. This is account balance, not gross sales or
            immediately withdrawable cash.
          </p>
        </>
      )}
    </section>
  );
}
