create table if not exists public.request_quotas (
  visitor_hash text not null,
  quota_date date not null,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (visitor_hash, quota_date)
);

create table if not exists public.model_runs (
  id uuid primary key default gen_random_uuid(),
  model_id text not null,
  model_snapshot text not null,
  prompt_version text not null,
  raw_response_hash text not null,
  labels text[] not null check (cardinality(labels) between 1 and 3),
  machine_caption text not null check (char_length(machine_caption) between 1 and 320),
  materials text[] not null default '{}',
  visible_text text[] not null default '{}',
  uncertainties text[] not null default '{}',
  run_mode text not null default 'single_live' check (run_mode = 'single_live'),
  archive_item_id uuid,
  created_at timestamptz not null default now()
);

alter table public.request_quotas enable row level security;
alter table public.model_runs enable row level security;

create or replace function public.increment_analysis_quota(
  p_visitor_hash text,
  p_quota_date date
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  next_count integer;
begin
  insert into public.request_quotas (visitor_hash, quota_date, request_count)
  values (p_visitor_hash, p_quota_date, 1)
  on conflict (visitor_hash, quota_date)
  do update set
    request_count = public.request_quotas.request_count + 1,
    updated_at = now()
  returning request_count into next_count;

  return next_count;
end;
$$;

revoke all on function public.increment_analysis_quota(text, date) from public;
grant execute on function public.increment_analysis_quota(text, date) to service_role;

create or replace function public.delete_orphan_model_runs()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.model_runs
  where archive_item_id is null
    and created_at < now() - interval '24 hours';
$$;

revoke all on function public.delete_orphan_model_runs() from public;
grant execute on function public.delete_orphan_model_runs() to service_role;

create extension if not exists pg_cron;

do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job
  from cron.job
  where jobname = 'cleanup-orphan-model-runs'
  limit 1;

  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;

  perform cron.schedule(
    'cleanup-orphan-model-runs',
    '17 3 * * *',
    'select public.delete_orphan_model_runs()'
  );
end;
$$;
