begin;
alter table revenue_intelligence.appointments
  add column if not exists booking_source text check (booking_source in ('live','replay','followup')),
  add column if not exists booking_source_event_id text;
alter table revenue_intelligence.webinars add column if not exists whatsapp_booking_url text;
notify pgrst, 'reload schema';
commit;
