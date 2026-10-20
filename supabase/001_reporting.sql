-- Rerunnable setup for the revenue_intelligence schema; preserves existing rows.
begin;
create schema if not exists revenue_intelligence;
set local search_path=revenue_intelligence,public;
create table if not exists revenue_intelligence.contacts(id uuid primary key default gen_random_uuid(),ghl_contact_id text unique,email text,phone text,first_name text not null default '',last_name text not null default '',trakyo_id text unique,created_at timestamptz not null default now());
create unique index if not exists contacts_email on revenue_intelligence.contacts(lower(email)) where email is not null;
create unique index if not exists contacts_phone on revenue_intelligence.contacts(phone) where phone is not null;
create table if not exists revenue_intelligence.webinars(id uuid primary key default gen_random_uuid(),provider text not null,external_id text not null,name text not null,webinar_date timestamptz not null,peak_attendees integer check(peak_attendees>=0),pitch_attendees integer check(pitch_attendees>=0),unique(provider,external_id));
create table if not exists revenue_intelligence.webinar_registrations(id uuid primary key default gen_random_uuid(),contact_id uuid not null references revenue_intelligence.contacts,webinar_id uuid not null references revenue_intelligence.webinars,registered_at timestamptz not null,raw_utm_source text not null default '',raw_utm_medium text not null default '',raw_utm_campaign text not null default '',raw_utm_content text not null default '',unique(contact_id,webinar_id));
create table if not exists revenue_intelligence.attribution_touches(id uuid primary key default gen_random_uuid(),contact_id uuid not null references revenue_intelligence.contacts,provider text not null,external_touch_id text not null,touch_type text not null check(touch_type in('first_touch','last_touch','conversion_touch')),source text not null default '',medium text not null default '',campaign text not null default '',content text not null default '',occurred_at timestamptz not null,unique(provider,external_touch_id));
create table if not exists revenue_intelligence.appointments(id uuid primary key default gen_random_uuid(),contact_id uuid not null references revenue_intelligence.contacts,ghl_appointment_id text not null unique,scheduled_at timestamptz not null,booked_at timestamptz not null,status text not null,closer text not null default '',webinar_id uuid references revenue_intelligence.webinars);
create table if not exists revenue_intelligence.sales_calls(id uuid primary key default gen_random_uuid(),contact_id uuid not null references revenue_intelligence.contacts,appointment_id uuid references revenue_intelligence.appointments,external_call_id text not null unique,call_date timestamptz not null,closer text not null default '',attendance text not null check(attendance in('attended','no_show','cancelled','rescheduled')),outcome text check(outcome in('sold','deposit','follow_up','no_sale','unqualified')),recording_url text);
create table if not exists revenue_intelligence.sales(id uuid primary key default gen_random_uuid(),contact_id uuid not null references revenue_intelligence.contacts,sales_call_id uuid references revenue_intelligence.sales_calls,provider text not null,external_sale_id text not null,offer text not null,payment_type text not null,contract_value bigint not null check(contract_value>=0),sold_at timestamptz not null,unique(provider,external_sale_id));
create table if not exists revenue_intelligence.payments(id uuid primary key default gen_random_uuid(),contact_id uuid not null references revenue_intelligence.contacts,sale_id uuid references revenue_intelligence.sales,provider text not null,external_payment_id text not null,amount bigint not null check(amount>0),currency text not null default 'USD' check(currency='USD'),status text not null check(status in('succeeded','pending','failed','refunded')),paid_at timestamptz not null,unique(provider,external_payment_id));
create table if not exists revenue_intelligence.source_mappings(id uuid primary key default gen_random_uuid(),dimension text not null check(dimension in('source','medium','campaign','content')),raw_value text not null,normalized_value text not null check(length(normalized_value)>0),unique(dimension,raw_value));
create table if not exists revenue_intelligence.sync_runs(id uuid primary key default gen_random_uuid(),source text not null,started_at timestamptz not null default now(),completed_at timestamptz,status text not null check(status in('running','succeeded','failed','not_configured')),records_processed integer not null default 0,records_failed integer not null default 0,error text);
create table if not exists revenue_intelligence.ingestion_events(provider text not null,event_id text not null,payload_hash text not null,contact_id uuid references revenue_intelligence.contacts,received_at timestamptz not null default now(),primary key(provider,event_id));
create index if not exists registrations_contact on revenue_intelligence.webinar_registrations(contact_id);
create index if not exists registrations_webinar_date on revenue_intelligence.webinar_registrations(webinar_id,registered_at);
create index if not exists touches_contact_time on revenue_intelligence.attribution_touches(contact_id,occurred_at);
create index if not exists appointments_contact on revenue_intelligence.appointments(contact_id);
create index if not exists calls_contact_date on revenue_intelligence.sales_calls(contact_id,call_date);
create index if not exists sales_contact on revenue_intelligence.sales(contact_id);
create index if not exists payments_sale on revenue_intelligence.payments(sale_id);
-- Service role only: never expose normalized revenue data to anon/authenticated clients.
do $$declare t text; begin foreach t in array array['contacts','webinars','webinar_registrations','attribution_touches','appointments','sales_calls','sales','payments','source_mappings','sync_runs','ingestion_events'] loop execute format('alter table revenue_intelligence.%I enable row level security',t);end loop;end$$;
grant usage on schema revenue_intelligence to service_role;
grant all on all tables in schema revenue_intelligence to service_role;

-- One transaction for identity resolution, replay protection and provider event persistence.
-- Shared names never participate in identity matching; conflicting identifiers are quarantined by caller.
create or replace function revenue_intelligence.ingest_contact_event(payload jsonb) returns jsonb language plpgsql security invoker set search_path=revenue_intelligence,public as $$
declare wid uuid; aid uuid; scid uuid; sid uuid; c jsonb:=payload->'contact'; cid uuid; candidates uuid[]; e jsonb; existing revenue_intelligence.ingestion_events%rowtype; identity text; ids text[]; v_provider text:=payload->>'provider'; v_event text:=payload->>'event_id'; hashed text:=encode(sha256(convert_to(payload::text,'UTF8')),'hex');
begin
 if v_provider is null or v_event is null then raise exception 'Provider and event ID required';end if;
 -- Locks are sorted to avoid deadlocks between overlapping identity keys.
 ids:=array_remove(array[c->>'ghl_contact_id',lower(nullif(trim(c->>'email'),'')),c->>'phone',c->>'trakyo_id'],null);
 if cardinality(ids)=0 then raise exception 'At least one identity required';end if;
 for identity in select unnest(ids) order by 1 loop perform pg_advisory_xact_lock(hashtextextended(identity,0));end loop;
 perform pg_advisory_xact_lock(hashtextextended(v_provider||':'||v_event,1));
 select * into existing from revenue_intelligence.ingestion_events where provider=v_provider and event_id=v_event;
 if found then if existing.payload_hash<>hashed then raise exception 'Replay payload conflict';end if;return jsonb_build_object('contact_id',existing.contact_id,'duplicate',true);end if;
 select array_agg(id) into candidates from revenue_intelligence.contacts where (c->>'ghl_contact_id' is not null and ghl_contact_id=c->>'ghl_contact_id') or (nullif(trim(c->>'email'),'') is not null and lower(email)=lower(trim(c->>'email'))) or (c->>'phone' is not null and phone=c->>'phone') or (c->>'trakyo_id' is not null and trakyo_id=c->>'trakyo_id');
 if cardinality(candidates)>1 then raise exception 'Identity conflict: manual review required';end if;
 cid:=candidates[1];
 if cid is not null then
  if exists(select 1 from revenue_intelligence.contacts where id=cid and ((ghl_contact_id is not null and c->>'ghl_contact_id' is not null and ghl_contact_id<>c->>'ghl_contact_id') or (trakyo_id is not null and c->>'trakyo_id' is not null and trakyo_id<>c->>'trakyo_id'))) then raise exception 'Canonical identity conflict';end if;
  update revenue_intelligence.contacts set ghl_contact_id=coalesce(ghl_contact_id,c->>'ghl_contact_id'),email=coalesce(email,lower(nullif(trim(c->>'email'),''))),phone=coalesce(phone,c->>'phone'),trakyo_id=coalesce(trakyo_id,c->>'trakyo_id'),first_name=coalesce(nullif(c->>'first_name',''),first_name),last_name=coalesce(nullif(c->>'last_name',''),last_name) where id=cid;
 else
  insert into revenue_intelligence.contacts(ghl_contact_id,email,phone,trakyo_id,first_name,last_name,created_at) values(c->>'ghl_contact_id',lower(nullif(trim(c->>'email'),'')),c->>'phone',c->>'trakyo_id',coalesce(c->>'first_name',''),coalesce(c->>'last_name',''),coalesce((c->>'created_at')::timestamptz,now())) returning id into cid;
 end if;
 for e in select * from jsonb_array_elements(coalesce(payload->'touches','[]')) loop
  insert into revenue_intelligence.attribution_touches(contact_id,provider,external_touch_id,touch_type,source,medium,campaign,content,occurred_at) values(cid,v_provider,e->>'external_touch_id',e->>'touch_type',coalesce(e->>'source',''),coalesce(e->>'medium',''),coalesce(e->>'campaign',''),coalesce(e->>'content',''),(e->>'occurred_at')::timestamptz) on conflict(provider,external_touch_id) do nothing;
 end loop;
 for e in select * from jsonb_array_elements(coalesce(payload->'webinars','[]')) loop
  insert into revenue_intelligence.webinars(provider,external_id,name,webinar_date,peak_attendees,pitch_attendees) values('webinars',e->>'external_id',e->>'name',(e->>'webinar_date')::timestamptz,(e->>'peak_attendees')::integer,(e->>'pitch_attendees')::integer) on conflict(provider,external_id) do update set name=excluded.name,peak_attendees=coalesce(excluded.peak_attendees,webinars.peak_attendees),pitch_attendees=coalesce(excluded.pitch_attendees,webinars.pitch_attendees);
 end loop;
 for e in select * from jsonb_array_elements(coalesce(payload->'registrations','[]')) loop
  select id into strict wid from revenue_intelligence.webinars where provider='webinars' and external_id=e->>'webinar_external_id';
  insert into revenue_intelligence.webinar_registrations(contact_id,webinar_id,registered_at,raw_utm_source,raw_utm_medium,raw_utm_campaign,raw_utm_content) values(cid,wid,(e->>'registered_at')::timestamptz,coalesce(e->>'raw_utm_source',''),coalesce(e->>'raw_utm_medium',''),coalesce(e->>'raw_utm_campaign',''),coalesce(e->>'raw_utm_content','')) on conflict(contact_id,webinar_id) do nothing;
 end loop;
 for e in select * from jsonb_array_elements(coalesce(payload->'appointments','[]')) loop
  wid:=null;
  if e->>'webinar_external_id' is not null then select id into strict wid from revenue_intelligence.webinars where provider='webinars' and external_id=e->>'webinar_external_id';end if;
  if exists(select 1 from revenue_intelligence.appointments where ghl_appointment_id=e->>'external_id' and contact_id<>cid) then raise exception 'Appointment identity conflict';end if;
  insert into revenue_intelligence.appointments(contact_id,ghl_appointment_id,scheduled_at,booked_at,status,closer,webinar_id) values(cid,e->>'external_id',(e->>'scheduled_at')::timestamptz,(e->>'booked_at')::timestamptz,e->>'status',coalesce(e->>'closer',''),wid) on conflict(ghl_appointment_id) do update set status=excluded.status,scheduled_at=excluded.scheduled_at,closer=excluded.closer;
 end loop;
 for e in select * from jsonb_array_elements(coalesce(payload->'calls','[]')) loop
  aid:=null;
  if e->>'appointment_external_id' is not null then select id into strict aid from revenue_intelligence.appointments where ghl_appointment_id=e->>'appointment_external_id' and contact_id=cid;end if;
  if exists(select 1 from revenue_intelligence.sales_calls where external_call_id=e->>'external_id' and contact_id<>cid) then raise exception 'Call identity conflict';end if;
  insert into revenue_intelligence.sales_calls(contact_id,appointment_id,external_call_id,call_date,closer,attendance,outcome,recording_url) values(cid,aid,e->>'external_id',(e->>'call_date')::timestamptz,coalesce(e->>'closer',''),e->>'attendance',e->>'outcome',e->>'recording_url') on conflict(external_call_id) do nothing;
 end loop;
 for e in select * from jsonb_array_elements(coalesce(payload->'sales','[]')) loop
  scid:=null;
  if e->>'call_external_id' is not null then select id into strict scid from revenue_intelligence.sales_calls where external_call_id=e->>'call_external_id' and contact_id=cid;end if;
  if exists(select 1 from revenue_intelligence.sales where provider=v_provider and external_sale_id=e->>'external_id' and contact_id<>cid) then raise exception 'Sale identity conflict';end if;
  insert into revenue_intelligence.sales(contact_id,sales_call_id,provider,external_sale_id,offer,payment_type,contract_value,sold_at) values(cid,scid,v_provider,e->>'external_id',e->>'offer',e->>'payment_type',(e->>'contract_value')::bigint,(e->>'sold_at')::timestamptz) on conflict(provider,external_sale_id) do nothing;
 end loop;
 for e in select * from jsonb_array_elements(coalesce(payload->'payments','[]')) loop
  sid:=null;
  if e->>'sale_external_id' is not null then select id into strict sid from revenue_intelligence.sales where provider=v_provider and external_sale_id=e->>'sale_external_id' and contact_id=cid;end if;
  if exists(select 1 from revenue_intelligence.payments where provider=v_provider and external_payment_id=e->>'external_payment_id' and (contact_id<>cid or amount<>(e->>'amount')::bigint or sale_id is distinct from sid)) then raise exception 'Payment replay conflict';end if;
  insert into revenue_intelligence.payments(contact_id,sale_id,provider,external_payment_id,amount,currency,status,paid_at) values(cid,sid,v_provider,e->>'external_payment_id',(e->>'amount')::bigint,e->>'currency',e->>'status',(e->>'paid_at')::timestamptz) on conflict(provider,external_payment_id) do update set status=excluded.status;
 end loop;
 insert into revenue_intelligence.ingestion_events(provider,event_id,payload_hash,contact_id) values(v_provider,v_event,hashed,cid);
 return jsonb_build_object('contact_id',cid,'duplicate',false);
end$$;
revoke all on function revenue_intelligence.ingest_contact_event(jsonb) from public;
grant execute on function revenue_intelligence.ingest_contact_event(jsonb) to service_role;
-- Dynamic normalization preserves exact raw values and responds to mapping edits immediately.
create or replace view revenue_intelligence.normalized_registrations with(security_invoker=true) as select r.*,coalesce(s.normalized_value,nullif(r.raw_utm_source,''),'(not set)') normalized_utm_source,coalesce(m.normalized_value,nullif(r.raw_utm_medium,''),'(not set)') normalized_utm_medium,coalesce(c.normalized_value,nullif(r.raw_utm_campaign,''),'(not set)') normalized_utm_campaign,coalesce(t.normalized_value,nullif(r.raw_utm_content,''),'(not set)') normalized_utm_content from revenue_intelligence.webinar_registrations r left join revenue_intelligence.source_mappings s on s.dimension='source' and s.raw_value=r.raw_utm_source left join revenue_intelligence.source_mappings m on m.dimension='medium' and m.raw_value=r.raw_utm_medium left join revenue_intelligence.source_mappings c on c.dimension='campaign' and c.raw_value=r.raw_utm_campaign left join revenue_intelligence.source_mappings t on t.dimension='content' and t.raw_value=r.raw_utm_content;
grant select on revenue_intelligence.normalized_registrations to service_role;
commit;
