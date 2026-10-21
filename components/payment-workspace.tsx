"use client";
import { useEffect, useRef, useState } from "react";
import type { Dataset, WhopPayment } from "../lib/model";
import { matchedContact } from "../lib/payment-history";
import {
  isCollected,
  paymentAnalytics,
  paymentStructure,
  sameBuyer,
  sameOrder,
} from "../lib/payment-analytics";
import { DateControl, SelectControl } from "./form-controls";
import { WhopBalance } from "./whop-balance";

const money = (n: number, currency: string, decimals = 2) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    n / 10 ** decimals,
  );
const pct = (n: number | null) =>
  n === null ? "—" : `${(n * 100).toFixed(1)}%`;
export function PaymentWorkspace({ data }: { data: Dataset }) {
  const [currency, setCurrency] = useState("USD"),
    [status, setStatus] = useState("collected"),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [selected, setSelected] = useState<string | null>(null),
    [search, setSearch] = useState("");
  const dialog = useRef<HTMLDialogElement>(null),
    returnFocus = useRef<HTMLElement | null>(null);
  const payments = data.whopPayments || [],
    analytics = paymentAnalytics(data, currency, from, to);
  const currencies = [...new Set(["USD", ...payments.map((p) => p.currency)])];
  const decimals = payments.find((p) => p.currency === currency)?.decimals ?? 2;
  const format = (n: number) => money(n, currency, decimals);
  const rows = payments
    .filter(
      (p) =>
        p.currency === currency &&
        (!from || (p.paid_at || p.created_at).slice(0, 10) >= from) &&
        (!to || (p.paid_at || p.created_at).slice(0, 10) <= to) &&
        (status === "all" ||
          (status === "collected" ? isCollected(p) : p.status === status)) &&
        `${p.customer_name} ${p.email || ""} ${p.id}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) =>
      (b.paid_at || b.created_at).localeCompare(a.paid_at || a.created_at),
    );
  const payment = payments.find((p) => p.id === selected),
    contact = payment ? matchedContact(data, payment) : undefined;
  const order = payment ? payments.filter((p) => sameOrder(payment, p)) : [],
    buyer = payment ? payments.filter((p) => sameBuyer(data, payment, p)) : [];
  const tx = payment
    ? data.trakyoTransactions?.filter((t) => t.reference_number === payment.id)
    : [];
  const open = (id: string) => {
    returnFocus.current = document.activeElement as HTMLElement;
    setSelected(id);
  };
  useEffect(() => {
    if (selected && !dialog.current?.open) dialog.current?.showModal();
  }, [selected]);
  const close = () => {
    dialog.current?.close();
    setSelected(null);
    returnFocus.current?.focus();
  };
  const totalContacts = analytics.structures.reduce(
    (s, v) => s + v.contacts,
    0,
  );
  const allCurrencyPaid = payments.filter(
    (p) =>
      isCollected(p) &&
      (!from || (p.paid_at || p.created_at).slice(0, 10) >= from) &&
      (!to || (p.paid_at || p.created_at).slice(0, 10) <= to),
  );
  const converted = allCurrencyPaid.filter((p) => p.usd_amount != null);
  const usdGross = converted.reduce((s, p) => s + (p.usd_amount || 0), 0);
  return (
    <>
      <WhopBalance data={data} />
      <section className="panel payment-mix">
        <div className="panel-head">
          <div>
            <h2>Payment structures</h2>
            <p>
              Current GHL contact classification, company-wide. Each contact
              counts once; repeat instalments are separate transactions below.
            </p>
          </div>
        </div>
        {data.crmStructuresError ? (
          <p className="error-banner">
            {data.crmStructuresError} · Contact totals unavailable.
          </p>
        ) : (
          <div className="kpi-grid">
            {analytics.structures.slice(0, 3).map((s) => (
              <div className="kpi" key={s.label}>
                <div className="kpi-label">{s.label}</div>
                <div className="kpi-value">{s.contacts}</div>
                <div className="kpi-detail">
                  contacts ·{" "}
                  {pct(totalContacts ? s.contacts / totalContacts : null)} of
                  contacts with a populated structure
                </div>
              </div>
            ))}
            <div className="kpi">
              <div className="kpi-label">Classified contacts</div>
              <div className="kpi-value">{totalContacts}</div>
              <div className="kpi-detail">
                {analytics.structures[3].contacts} unrecognised values · blank
                fields excluded
              </div>
            </div>
          </div>
        )}
        <p className="revenue-trend-note">
          Latest-call snapshot, not lifetime purchases.{" "}
          {data.crmStructuresFetchedAt
            ? `GHL checked ${new Date(data.crmStructuresFetchedAt).toLocaleString("en-GB")}. `
            : ""}
          Read directly from GHL on each 15-second live refresh while this tab
          is visible.
        </p>
        {!data.crmStructuresError && totalContacts === 0 && (
          <p className="revenue-trend-note">
            No GHL contacts have Payment Structure populated yet. The new
            Payment Desk mapping fills this on future completed calls; existing
            purchases have not been backfilled.
          </p>
        )}
      </section>
      <section className="panel whop-history">
        <div className="panel-head">
          <div>
            <h2>Whop transactions & volume</h2>
            <p>
              Company-wide payment history · refreshes every 15 seconds while
              this dashboard is visible.
            </p>
          </div>
          <div className="revenue-trend-controls">
            <SelectControl
              aria-label="Whop currency"
              value={currency}
              onValueChange={setCurrency}
            >
              {currencies.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </SelectControl>
            <DateControl
              aria-label="Whop start date"
              value={from}
              onValueChange={setFrom}
            />
            <DateControl
              aria-label="Whop end date"
              value={to}
              onValueChange={setTo}
            />
          </div>
        </div>
        {from && to && from > to ? (
          <p className="error-banner">Start date must be before end date.</p>
        ) : null}
        {data.whopHistoryError ? (
          <p className="error-banner">
            {data.whopHistoryError} · Totals below are the last available
            snapshot, not current.
          </p>
        ) : null}
        <div className="payment-provider-total">
          <div>
            <span>All-currency gross · Whop USD conversion</span>
            <strong>
              {converted.length === allCurrencyPaid.length
                ? money(usdGross, "USD")
                : "Unavailable"}
            </strong>
          </div>
          <p>
            {allCurrencyPaid.length} successful charges across all currencies in
            this date range. Uses Whop’s own usd_total for each payment; not a
            payout balance.{" "}
            {converted.length !== allCurrencyPaid.length
              ? `${allCurrencyPaid.length - converted.length} payments lack provider conversion.`
              : ""}
          </p>
        </div>
        <div className="kpi-grid">
          <div className="kpi">
            <div className="kpi-label">Gross payment volume · {currency}</div>
            <div className="kpi-value">{format(analytics.gross)}</div>
            <div className="kpi-detail">
              Successful charges, before refunds and fees
            </div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Refunds · {currency}</div>
            <div className="kpi-value">{format(analytics.refunds)}</div>
            <div className="kpi-detail">
              Current refunds on selected payments
            </div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Net receipts · {currency}</div>
            <div className="kpi-value">{format(analytics.net)}</div>
            <div className="kpi-detail">Gross less refunds · before fees</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Successful charges</div>
            <div className="kpi-value">{analytics.paid.length}</div>
            <div className="kpi-detail">
              Whop payment events · selected currency and dates
            </div>
          </div>
        </div>
        <div className="payment-ledger-controls">
          <input
            aria-label="Search Whop transactions"
            placeholder="Search customer, email or payment ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <SelectControl
            aria-label="Whop status"
            value={status}
            onValueChange={setStatus}
          >
            <option value="collected">
              Successful charges (including refunded)
            </option>
            <option value="failed">Failed / blocked</option>
            <option value="pending">Pending</option>
            <option value="refunded">Fully refunded</option>
            <option value="all">All attempts</option>
          </SelectControl>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Paid / created (UTC)</th>
                <th>Customer</th>
                <th>CRM structure (current)</th>
                <th>Status</th>
                <th>Gross</th>
                <th>Refunded</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td>
                    {new Date(p.paid_at || p.created_at).toLocaleString(
                      "en-GB",
                      { timeZone: "UTC" },
                    )}
                  </td>
                  <td>
                    {p.customer_name}
                    <div className="muted">
                      {p.email ||
                        matchedContact(data, p)?.email ||
                        "Email unavailable"}
                    </div>
                  </td>
                  <td>{paymentStructure(data, p).value}</td>
                  <td>{p.status}</td>
                  <td>{money(p.amount, p.currency, p.decimals)}</td>
                  <td>{money(p.refunded, p.currency, p.decimals)}</td>
                  <td>
                    <button
                      className="secondary"
                      onClick={() => open(p.id)}
                      aria-label={`View payment ${p.id}`}
                    >
                      View payment ↗
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <p className="revenue-trend-empty">No matching transactions.</p>
        )}
        <p className="revenue-trend-note">
          {rows.length} shown · {analytics.paid.length} successful charges /{" "}
          {analytics.attempts} attempts in selected currency and UTC date range.
          Totals ignore search/status filters.{" "}
          {data.whopFetchedAt
            ? `Whop checked ${new Date(data.whopFetchedAt).toLocaleTimeString("en-GB")}.`
            : ""}{" "}
          Other dashboard cohort filters do not apply here. Whop totals only
          reconcile with the same account, dates, currency and volume
          definition; no FX conversion is applied.
        </p>
      </section>
      <dialog
        ref={dialog}
        className="payment-dialog"
        onCancel={close}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        aria-labelledby="payment-detail-title"
        onClose={() => {
          setSelected(null);
          returnFocus.current?.focus();
        }}
      >
        {payment && (
          <>
            <div className="modal-head">
              <div>
                <div className="eyebrow">Whop payment</div>
                <h2 id="payment-detail-title">{payment.customer_name}</h2>
                <code>{payment.id}</code>
              </div>
              <button className="secondary" onClick={close}>
                Close
              </button>
            </div>
            <div className="payment-detail-grid">
              {Object.entries({
                Email:
                  payment.email ||
                  contact?.email ||
                  "Unavailable from provider",
                Status: payment.status,
                "Customer charged": payment.presentment
                  ? money(
                      payment.presentment.amount,
                      payment.presentment.currency,
                      payment.presentment.decimals,
                    )
                  : "Not supplied",
                "Whop USD amount":
                  payment.usd_amount != null
                    ? money(payment.usd_amount, "USD")
                    : "Not supplied",
                Gross: money(
                  payment.amount,
                  payment.currency,
                  payment.decimals,
                ),
                Refunded: money(
                  payment.refunded,
                  payment.currency,
                  payment.decimals,
                ),
                "Net before fees": money(
                  payment.net,
                  payment.currency,
                  payment.decimals,
                ),
                "Payment method": payment.payment_method || "Not supplied",
                Structure: paymentStructure(data, payment).value,
                "Structure evidence": paymentStructure(data, payment).source,
                "Whop user": payment.user_id || "Not supplied",
                Plan: payment.plan_id || "Not supplied",
                Product: payment.product_id || "Not supplied",
                Membership: payment.membership_id || "Not supplied",
                "Billing reason": payment.billing_reason || "Not supplied",
                "CRM contact": contact
                  ? `${contact.first_name} ${contact.last_name}`
                  : "No verified match",
                "Trakyo reference":
                  tx?.map((t) => t.id).join(", ") ||
                  "No exact payment-reference match",
              }).map(([key, value]) => (
                <div key={key}>
                  <span>{key}</span>
                  <b>{value}</b>
                </div>
              ))}
            </div>
            {contact?.ghl_contact_id && (
              <a
                className="secondary"
                target="_blank"
                rel="noreferrer"
                href={`https://app.gohighlevel.com/v2/location/WgeDf11I8yBah6LRzZL1/contacts/detail/${encodeURIComponent(contact.ghl_contact_id)}`}
              >
                Open verified CRM contact ↗
              </a>
            )}
            <h3>Payments for this purchase</h3>
            <p className="muted">
              {payment.membership_id || payment.checkout_session_id
                ? `${order.filter(isCollected).length} successful payments sharing the same membership or checkout.`
                : "No shared order identifier is available. Only this payment can be verified for this purchase."}
            </p>
            <PaymentList rows={order} />
            <h3>Customer payment history</h3>
            <p className="muted">
              {buyer.filter(isCollected).length} successful payments matched by
              Whop user ID or verified CRM identity. Different purchases may be
              included; this is not a remaining-instalment schedule.
            </p>
            <PaymentList rows={buyer} />
            {data.trakyoTransactionsError && (
              <p className="error-banner">{data.trakyoTransactionsError}</p>
            )}
          </>
        )}
      </dialog>
    </>
  );
}
function PaymentList({ rows }: { rows: WhopPayment[] }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Date (UTC)</th>
            <th>Payment</th>
            <th>Status</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id}>
              <td>{(p.paid_at || p.created_at).slice(0, 10)}</td>
              <td>
                <code>{p.id}</code>
              </td>
              <td>{p.status}</td>
              <td>{money(p.amount, p.currency, p.decimals)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
