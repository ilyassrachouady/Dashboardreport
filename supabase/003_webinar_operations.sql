-- Session operations and per-person attendance. Preserves existing reporting data.
begin;
alter table revenue_intelligence.webinars
  add column if not exists event_status text not null default 'unknown' check (event_status in ('unknown','planned','ready','completed','cancelled')),
  add column if not exists promotion_type text not null default 'unknown' check (promotion_type in ('unknown','organic','paid','mixed')),
  add column if not exists presenter_url text,
  add column if not exists slides_url text,
  add column if not exists replay_url text,
  add column if not exists notion_page_url text,
  add column if not exists live_booking_url text,
  add column if not exists replay_booking_url text,
  add column if not exists followup_booking_url text,
  add column if not exists operations_updated_at timestamptz;
create table if not exists revenue_intelligence.webinar_attendance (
  id uuid primary key default gen_random_uuid(),
  webinar_id uuid not null references revenue_intelligence.webinars(id),
  contact_id uuid not null references revenue_intelligence.contacts(id),
  attended_live boolean,
  attended_replay boolean,
  evidence_source text not null check (evidence_source in ('provider','import')),
  updated_at timestamptz not null default now(),
  unique(webinar_id,contact_id),
  check (attended_live is not null or attended_replay is not null)
);
alter table revenue_intelligence.webinar_attendance enable row level security;
revoke all on revenue_intelligence.webinar_attendance from anon,authenticated;
grant all on revenue_intelligence.webinar_attendance to service_role;
create or replace function revenue_intelligence.import_webinar_attendance(session_id uuid, evidence jsonb)
returns integer language plpgsql security invoker set search_path = revenue_intelligence,pg_temp as $$
declare affected integer;
begin
  insert into revenue_intelligence.webinar_attendance as existing
    (webinar_id,contact_id,attended_live,attended_replay,evidence_source)
  select session_id, r.contact_id, r.attended_live, r.attended_replay, 'import'
  from jsonb_to_recordset(evidence) as r(contact_id uuid, attended_live boolean, attended_replay boolean)
  on conflict (webinar_id,contact_id) do update set
    attended_live = coalesce(excluded.attended_live, existing.attended_live),
    attended_replay = coalesce(excluded.attended_replay, existing.attended_replay),
    evidence_source = 'import', updated_at = now();
  get diagnostics affected = row_count;
  return affected;
end $$;
revoke all on function revenue_intelligence.import_webinar_attendance(uuid,jsonb) from public,anon,authenticated;
grant execute on function revenue_intelligence.import_webinar_attendance(uuid,jsonb) to service_role;
notify pgrst, 'reload schema';
commit;
