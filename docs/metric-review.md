# Dashboard metric review — 21 October 2026

Source/code review, not a reconciliation of every live customer transaction.

| Measure | Source and meaning | Limit |
| --- | --- | --- |
| Cash collected · GHL | Sum current GHL Cash Collected once per contact | Can include a first instalment. Do not add the initial-payment input again. Not processor confirmation or a historical receipts ledger. |
| Agreed investment | GHL Agreed Total Investment on Sold contacts | Full agreed contract value, not cash received. |
| PIF/manual/financing | Current GHL Payment Structure | Unique contacts, not number of transactions. Blank/unrecognised values excluded from percentages. |
| Attended / Sold | Current GHL Attendance / Call Outcome | Latest contact state, not lifetime calls; independent of report date and webinar filters. |
| Close rate | Sold-and-Attended contacts / Attended contacts | Latest-state contact ratio only. |
| Source activity | Imported registrations, appointments, recorded calls and agreements | These have different coverage. Removed conversion ratios that implied a shared cohort. Current GHL cash shown only for linked imported contacts. |
| Whop receipts / volume | Successful processor payment records | Different from GHL cash and account balance. Native currencies kept separate; all-currency USD conversion labelled. Test payments can be present. |
| Whop account balance | Direct Whop account holdings | Includes available/pending/reserved funds and currency conversion; not gross sales. |
| First matched Whop payment | First matched stored successful receipt | Missing match means unknown receipt history, not proof the customer has not paid. |
| Webinar rates | Session counts and imported unique registrations | Peak and pitch need supplied session data. TCS001 confirmed total is 274 unique registrants. |

## Remaining data requirements

- GHL Cash Collected is a single current value. A separate first-instalment versus subsequent-instalments breakdown cannot be inferred reliably from it. Keep payment-event history for that breakdown; do not invent values from contract minus cash.
- Current GHL snapshots cannot provide historical weekly attendance, historical closer ownership, or cash-by-payment-date. Those require dated events/history.
- Imported Payment Desk history is incomplete and includes test activity; retain explicit labels.
- CRM refresh is approximately every 15 seconds while visible, plus request time. Provider failures must remain visible; this is not instantaneous streaming.
