export type Dimension = "source" | "medium" | "campaign" | "content";
export interface Contact {
  id: string;
  ghl_contact_id: string | null;
  email: string | null;
  phone: string | null;
  first_name: string;
  last_name: string;
  trakyo_id: string | null;
  created_at: string;
}
export interface Webinar {
  notion_page_id?: string | null;
  ghl_cohort_tag?: string | null;
  notion_managed?: boolean;
  notion_updated_at?: string;
  notion_error?: string | null;
  event_status?: "unknown" | "planned" | "ready" | "completed" | "cancelled";
  promotion_type?: "unknown" | "organic" | "paid" | "mixed";
  presenter_url?: string | null;
  slides_url?: string | null;
  replay_url?: string | null;
  notion_page_url?: string | null;
  live_booking_url?: string | null;
  replay_booking_url?: string | null;
  followup_booking_url?: string | null;
  whatsapp_booking_url?: string | null;
  operations_updated_at?: string | null;
  id: string;
  external_id: string;
  session_code?: string | null;
  client_series?: "TCS" | "QUE" | null;
  released_codes?: string | null;
  name: string;
  webinar_date: string;
  webinar_ended_at?: string | null;
  peak_attendees: number | null;
  pitch_attendees: number | null;
  application_count?: number | null;
  call_booked_count?: number | null;
  applicant_booked_count?: number | null;
  kpi_updated_at?: string | null;
}
export interface Registration {
  id: string;
  contact_id: string;
  webinar_id: string;
  registered_at: string;
  raw_utm_source: string;
  raw_utm_medium: string;
  raw_utm_campaign: string;
  raw_utm_content: string;
}
export interface Touch {
  id: string;
  contact_id: string;
  provider: string;
  touch_type: string;
  source: string;
  medium: string;
  campaign: string;
  content: string;
  occurred_at: string;
}
export interface Appointment {
  booking_source?: "live" | "replay" | "followup" | null;
  booking_source_event_id?: string | null;
  id: string;
  contact_id: string;
  scheduled_at: string;
  booked_at: string;
  status: string;
  closer: string;
  webinar_id: string | null;
}
export interface Call {
  id: string;
  contact_id: string;
  appointment_id: string | null;
  call_date: string;
  closer: string;
  attendance: string;
  outcome: string | null;
  recording_url: string | null;
}
export interface WhopPayment {
  usd_amount?: number | null;
  presentment?: { currency: string; amount: number; decimals: number } | null;
  user_id?: string | null;
  membership_id?: string | null;
  plan_id?: string | null;
  product_id?: string | null;
  payment_method?: string | null;
  billing_reason?: string | null;
  financing_installments?: number | null;
  id: string;
  currency: string;
  decimals: number;
  amount: number;
  refunded: number;
  net: number;
  status: string;
  paid_at: string | null;
  created_at: string;
  customer_name: string;
  ghl_contact_id: string | null;
  email: string | null;
  checkout_session_id: string | null;
}
export interface Sale {
  external_sale_id?: string;
  id: string;
  contact_id: string;
  sales_call_id: string | null;
  offer: string;
  payment_type: string;
  contract_value: number;
  sold_at: string;
}
export interface Payment {
  id: string;
  contact_id: string;
  sale_id: string | null;
  provider: string;
  external_payment_id: string;
  amount: number;
  status: string;
  paid_at: string;
}
export interface Mapping {
  id: string;
  dimension: Dimension;
  raw_value: string;
  normalized_value: string;
}
export interface SyncRun {
  id: string;
  source: string;
  started_at: string;
  completed_at: string | null;
  status: string;
  records_processed: number;
  records_failed: number;
  error: string | null;
}
export interface Dataset {
  webinarAttendance?: {webinar_id:string;contact_id:string;attended_live:boolean|null;attended_replay:boolean|null}[];
  crmApplications?: {ghl_contact_id:string;applied:boolean}[];
  crmApplicationsError?: string | null;
  whopBalance?: {
    totalUsd: string;
    fetchedAt: string;
    currencies: {
      currency: string;
      balance: string;
      valueUsd: string | null;
      available: string;
      pending: string;
      reserve: string;
    }[];
  };
  whopBalanceError?: string;
  crmPaymentStructures?: { ghl_contact_id: string; value: string }[];
  crmStructuresFetchedAt?: string;
  crmStructuresError?: string;
  crmCash?: { ghl_contact_id: string; cashCents: number | null }[];
  crmCashError?: string;
  crmAttendance?: { ghl_contact_id: string; value: string }[];
  crmAttendanceError?: string;
  crmCallSnapshots?: {
    ghl_contact_id: string;
    closer: string;
    attendance: string;
    outcome: string;
    structure: string;
    cashCents: number | null;
    contractCents: number | null;
  }[];
  crmAttribution?: {ghl_contact_id:string;source:string;content:string;campaign:string;firstTouch:string;lastTouch:string}[];
  crmSnapshotError?: string;
  whopFetchedAt?: string;
  trakyoTransactions?: {
    id: string;
    lead_id: string | null;
    reference_number: string | null;
    transaction_date: string;
    payment_method: string | null;
  }[];
  trakyoTransactionsError?: string;
  whopPayments?: WhopPayment[];
  whopHistoryError?: string;
  webinarCrm?: Record<
    string,
    { tag: string; syncedAt: string | null; bookingsSyncedAt?: string | null }
  >;
  contacts: Contact[];
  webinars: Webinar[];
  registrations: Registration[];
  touches: Touch[];
  appointments: Appointment[];
  calls: Call[];
  sales: Sale[];
  payments: Payment[];
  mappings: Mapping[];
  syncRuns: SyncRun[];
}
export const emptyDataset = (): Dataset => ({
  contacts: [],
  webinars: [],
  registrations: [],
  touches: [],
  appointments: [],
  calls: [],
  sales: [],
  payments: [],
  mappings: [],
  syncRuns: [],
});
export type Filters = {
  from: string;
  to: string;
  webinar: string;
  source: string;
  medium: string;
  campaign: string;
  content: string;
  trakyoSource: string;
  trakyoCampaign: string;
  closer: string;
  offer: string;
  model: "first" | "last";
};
export const defaultFilters: Filters = {
  from: "",
  to: "",
  webinar: "",
  source: "",
  medium: "",
  campaign: "",
  content: "",
  trakyoSource: "",
  trakyoCampaign: "",
  closer: "",
  offer: "",
  model: "first",
};
