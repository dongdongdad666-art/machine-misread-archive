create unique index if not exists request_quotas_visitor_day_key
  on public.request_quotas (visitor_hash, quota_date);

create table if not exists public.archive_items (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null unique references public.model_runs(id),
  accession_no text not null unique,
  submission_token text not null unique,
  status text not null default 'pending_review'
    check (status in ('draft', 'pending_review', 'published', 'rejected', 'withdrawn')),
  object_name text not null,
  time_range text not null,
  city text,
  memory_text text not null check (char_length(memory_text) between 20 and 400),
  relation text not null,
  emotion_tags text[] not null default '{}' check (cardinality(emotion_tags) <= 3),
  source_visibility text not null default 'private'
    check (source_visibility in ('private', 'public')),
  artifact_visibility text not null default 'private'
    check (artifact_visibility in ('private', 'public_requested', 'public')),
  consent_version text not null,
  source_path text,
  artifact_path text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.moderation_events (
  id uuid primary key default gen_random_uuid(),
  archive_item_id uuid not null references public.archive_items(id) on delete cascade,
  decision text not null check (decision in ('approve', 'reject', 'request_change', 'withdraw')),
  reason_codes text[] not null default '{}',
  note text,
  actor_label text not null,
  created_at timestamptz not null default now()
);

do $$
begin
  alter table public.model_runs
    add constraint model_runs_archive_item_id_fkey
    foreign key (archive_item_id) references public.archive_items(id) on delete set null;
exception
  when duplicate_object then null;
end;
$$;

create unique index if not exists model_runs_archive_item_id_key
  on public.model_runs (archive_item_id)
  where archive_item_id is not null;

alter table public.archive_items enable row level security;
alter table public.moderation_events enable row level security;

revoke insert, update, delete on table public.archive_items from anon, authenticated;
revoke all on table public.moderation_events from anon, authenticated;
grant select on table public.archive_items to anon, authenticated;

create policy "Published archives are readable"
  on public.archive_items
  for select
  to anon, authenticated
  using (status = 'published');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('source-private', 'source-private', false, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('artifacts-public', 'artifacts-public', false, 2097152, array['image/png'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Published source objects are readable"
  on storage.objects
  for select
  to anon, authenticated
  using (
    bucket_id = 'source-private'
    and (storage.foldername(name))[1] = 'published-sources'
    and exists (
      select 1
      from public.archive_items
      where archive_items.id::text = (storage.foldername(name))[2]
        and archive_items.status = 'published'
        and archive_items.source_visibility = 'public'
    )
  );

create policy "Published artifact metadata is readable"
  on storage.objects
  for select
  to anon, authenticated
  using (
    bucket_id = 'artifacts-public'
    and (storage.foldername(name))[1] = 'published'
    and exists (
      select 1
      from public.archive_items
      where archive_items.id::text = (storage.foldername(name))[2]
        and archive_items.status = 'published'
        and archive_items.artifact_visibility = 'public'
    )
  );

create or replace function public.create_pending_archive_submission(
  p_analysis_id uuid,
  p_accession_no text,
  p_submission_token text,
  p_object_name text,
  p_time_range text,
  p_city text,
  p_memory_text text,
  p_relation text,
  p_emotion_tags text[],
  p_source_visibility text,
  p_artifact_visibility text,
  p_consent_version text,
  p_source_path text,
  p_artifact_path text
) returns table (id uuid, accession_no text, artifact_path text, source_path text)
language plpgsql
security definer
set search_path = public
as $$
declare
  run public.model_runs%rowtype;
  archive_id uuid;
  archive_analysis_id uuid;
begin
  select archive_items.id, archive_items.analysis_id
  into archive_id, archive_analysis_id
  from public.archive_items
  where archive_items.submission_token = p_submission_token;

  if found then
    if archive_analysis_id <> p_analysis_id then
      raise exception 'submission_token_conflict';
    end if;
    return query
      select archive_items.id, archive_items.accession_no,
        archive_items.artifact_path, archive_items.source_path
      from public.archive_items
      where archive_items.id = archive_id;
    return;
  end if;

  select * into run
  from public.model_runs
  where model_runs.id = p_analysis_id
  for update;

  if not found then
    raise exception 'analysis_not_found';
  end if;
  if run.archive_item_id is not null then
    raise exception 'analysis_already_submitted';
  end if;
  if run.semantic_gap is null
    or run.gap_algorithm_version <> 'gap-v1'
    or run.generation_engine_version <> 'residue-v1' then
    raise exception 'analysis_not_publishable';
  end if;

  insert into public.archive_items (
    analysis_id, accession_no, submission_token, status, object_name, time_range, city, memory_text, relation,
    emotion_tags, source_visibility, artifact_visibility, consent_version,
    source_path, artifact_path
  ) values (
    p_analysis_id, p_accession_no, p_submission_token, 'pending_review', p_object_name, p_time_range, nullif(p_city, ''),
    p_memory_text, p_relation, p_emotion_tags, p_source_visibility,
    p_artifact_visibility, p_consent_version, p_source_path, p_artifact_path
  ) returning archive_items.id into archive_id;

  update public.model_runs
  set archive_item_id = archive_id
  where model_runs.id = p_analysis_id;

  return query
    select archive_items.id, archive_items.accession_no,
      archive_items.artifact_path, archive_items.source_path
    from public.archive_items
    where archive_items.id = archive_id;
end;
$$;

revoke all on function public.create_pending_archive_submission(
  uuid, text, text, text, text, text, text, text, text[], text, text, text, text, text
) from public;
grant execute on function public.create_pending_archive_submission(
  uuid, text, text, text, text, text, text, text, text[], text, text, text, text, text
) to service_role;
