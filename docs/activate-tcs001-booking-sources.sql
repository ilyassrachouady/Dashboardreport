-- Run once in the reporting project's Supabase SQL Editor.
-- Schema plus the explicitly verified links for TCS001 only.
begin;
alter table revenue_intelligence.appointments
  add column if not exists booking_source text check (booking_source in ('live','replay','followup')),
  add column if not exists booking_source_event_id text;
alter table revenue_intelligence.webinars add column if not exists whatsapp_booking_url text;
update revenue_intelligence.webinars set
  live_booking_url = 'https://go.thecreatorsociety.ca/start',
  replay_booking_url = 'https://go.thecreatorsociety.ca/cc82b109',
  followup_booking_url = 'https://go.thecreatorsociety.ca/apply',
  whatsapp_booking_url = 'https://go.thecreatorsociety.ca/gptp'
where id = '474e11d2-0044-4956-b3e0-79d5b33875ef' and session_code = 'TCS001';
notify pgrst, 'reload schema';
commit;
