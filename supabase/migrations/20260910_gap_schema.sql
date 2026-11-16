alter table public.model_runs
  add column if not exists semantic_gap double precision
    check (semantic_gap between 0 and 1),
  add column if not exists gap_algorithm_version text,
  add column if not exists generation_seed bigint,
  add column if not exists generation_engine_version text,
  add column if not exists visual_parameters jsonb;
