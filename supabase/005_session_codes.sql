begin;
alter table revenue_intelligence.webinars
  add column if not exists client_series text not null default 'TCS' check (client_series in ('TCS','QUE')),
  add column if not exists session_code text,
  add column if not exists released_codes text not null default '';
create unique index if not exists webinars_session_code_unique
  on revenue_intelligence.webinars(session_code) where session_code is not null;
notify pgrst, 'reload schema';
commit;
