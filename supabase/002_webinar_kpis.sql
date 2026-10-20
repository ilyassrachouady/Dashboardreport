begin;
alter table revenue_intelligence.webinars
 add column if not exists application_count integer check(application_count>=0),
 add column if not exists call_booked_count integer check(call_booked_count>=0),
 add column if not exists applicant_booked_count integer check(applicant_booked_count>=0),
 add column if not exists kpi_updated_at timestamptz;
notify pgrst, 'reload schema';
commit;
