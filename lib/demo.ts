import { assignMissingSessionCodes } from "./session-code";
import { emptyDataset } from "./model";
export function demoDataset() {
  const d = emptyDataset();
  d.webinars = assignMissingSessionCodes([
    {
      id: "w1",
      external_id: "demo-oct-14",
      name: "Get Paid to Post",
      webinar_date: "2026-10-14T19:00:00Z",
      peak_attendees: 72,
      pitch_attendees: 67,
    },
    {
      id: "w2",
      external_id: "demo-oct-07",
      name: "Your First Brand Deal",
      webinar_date: "2026-10-07T19:00:00Z",
      peak_attendees: 61,
      pitch_attendees: 49,
    },
    {
      id: "w3",
      external_id: "demo-sep-30",
      name: "The Creator Playbook",
      webinar_date: "2026-09-30T19:00:00Z",
      peak_attendees: 54,
      pitch_attendees: 43,
    },
  ]);
  const sources = ["instagram", "youtube", "ig", "email", "facebook", "direct"];
  const names = [
    "Olivia",
    "Amelia",
    "Isla",
    "Ava",
    "Mia",
    "Sophia",
    "Grace",
    "Freya",
    "Lily",
    "Ella",
    "Noah",
    "Leo",
    "Oscar",
    "Theo",
    "Arthur",
    "James",
  ];
  const surnames = [
    "Williams",
    "Brown",
    "Wilson",
    "Taylor",
    "Davies",
    "Evans",
    "Thomas",
    "Johnson",
    "Roberts",
    "Walker",
  ];
  for (let i = 0; i < 168; i++) {
    const id = `c${i}`,
      source = sources[i % 6],
      wid = `w${1 + (i % 3)}`,
      day = 1 + (i % 14),
      date = `2026-10-${String(day).padStart(2, "0")}T10:00:00Z`;
    d.contacts.push({
      id,
      ghl_contact_id: i % 29 === 0 ? null : `demo-ghl-${i}`,
      email:
        i % 31 === 0 ? null : `${names[i % 16].toLowerCase()}.${i}@example.com`,
      phone: `+1555000${String(i).padStart(4, "0")}`,
      first_name: names[i % 16],
      last_name: surnames[i % 10],
      trakyo_id: `demo-tr-${i}`,
      created_at: date,
    });
    if (i < 154)
      d.registrations.push({
        id: `r${i}`,
        contact_id: id,
        webinar_id: wid,
        registered_at: date,
        raw_utm_source: source,
        raw_utm_medium: i % 2 ? "organic" : "paid",
        raw_utm_campaign: i % 3 ? "creator-october" : "brand-deal-launch",
        raw_utm_content: i % 2 ? "founder-story" : "student-results",
      });
    if (i % 19 !== 0) {
      d.touches.push({
        id: `t${i}`,
        contact_id: id,
        provider: "utm",
        touch_type: "first_touch",
        source,
        medium: i % 2 ? "organic" : "paid",
        campaign: i % 3 ? "creator-october" : "brand-deal-launch",
        content: i % 2 ? "founder-story" : "student-results",
        occurred_at: date,
      });
      d.touches.push({
        id: `tl${i}`,
        contact_id: id,
        provider: "trakyo",
        touch_type: "last_touch",
        source: i % 4 === 0 ? "youtube" : source,
        medium: "organic",
        campaign: "october-retargeting",
        content: "creator-proof",
        occurred_at: date.replace("10:00", "11:00"),
      });
    }
    if (i % 4 !== 3) {
      const closer = i % 2 ? "Brooklyn Martin" : "Lewis Kirby";
      d.appointments.push({
        id: `a${i}`,
        contact_id: id,
        scheduled_at: date.replace("10:00", "13:00"),
        booked_at: date,
        status: i % 13 === 0 ? "cancelled" : "confirmed",
        closer,
        webinar_id: wid,
      });
      d.calls.push({
        id: `sc${i}`,
        contact_id: id,
        appointment_id: `a${i}`,
        call_date: date.replace("10:00", "13:00"),
        closer,
        attendance:
          i % 13 === 0 ? "cancelled" : i % 7 === 0 ? "no_show" : "attended",
        outcome:
          i % 13 === 0 || i % 7 === 0
            ? null
            : i % 5 === 0
              ? "sold"
              : "follow_up",
        recording_url: null,
      });
      if (i % 5 === 0 && i % 7 !== 0 && i % 13 !== 0) {
        d.sales.push({
          id: `s${i}`,
          contact_id: id,
          sales_call_id: `sc${i}`,
          offer: i % 4 ? "Sofia 1:1" : "Creator Coaching",
          payment_type: i % 4 ? "two" : "pif",
          contract_value: i % 4 ? 420000 : 199700,
          sold_at: date.replace("10:00", "14:00"),
        });
        d.payments.push({
          id: `p${i}`,
          contact_id: id,
          sale_id: `s${i}`,
          provider: "whop",
          external_payment_id: `demo-pay-${i}`,
          amount: i % 4 ? 140000 : 199700,
          status: "succeeded",
          paid_at: date.replace("10:00", "14:10"),
        });
      }
    }
  }
  d.mappings = [
    {
      id: "m1",
      dimension: "source",
      raw_value: "ig",
      normalized_value: "instagram",
    },
    {
      id: "m2",
      dimension: "source",
      raw_value: "instagram",
      normalized_value: "instagram",
    },
    {
      id: "m3",
      dimension: "source",
      raw_value: "youtube",
      normalized_value: "youtube",
    },
    {
      id: "m4",
      dimension: "source",
      raw_value: "email",
      normalized_value: "email",
    },
    {
      id: "m5",
      dimension: "source",
      raw_value: "facebook",
      normalized_value: "facebook",
    },
    {
      id: "m6",
      dimension: "source",
      raw_value: "direct",
      normalized_value: "direct",
    },
  ];
  d.syncRuns = ["ghl", "trakyo", "webinars", "whop"].map((source, i) => ({
    id: `sync${i}`,
    source,
    started_at: "2026-10-14T20:00:00Z",
    completed_at: "2026-10-14T20:01:00Z",
    status: i === 1 ? "not_configured" : "demo",
    records_processed: 0,
    records_failed: 0,
    error: null,
  }));
  return d;
}
