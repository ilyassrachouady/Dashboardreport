begin;
alter table revenue_intelligence.webinars
  add column if not exists notion_page_id uuid,
  add column if not exists ghl_cohort_tag text;
create unique index if not exists webinar_notion_page_unique
  on revenue_intelligence.webinars(notion_page_id) where notion_page_id is not null;
create unique index if not exists webinar_ghl_tag_unique
  on revenue_intelligence.webinars(ghl_cohort_tag) where ghl_cohort_tag is not null;
notify pgrst, 'reload schema';
commit;
