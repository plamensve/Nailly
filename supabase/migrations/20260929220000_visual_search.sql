-- Run after marketplace migration when the Python visual-search service is ready.
create schema if not exists extensions;
create extension if not exists vector with schema extensions;
alter table public.portfolio_looks add column if not exists storage_path text;
create table if not exists public.look_embeddings (
  look_id uuid primary key references public.portfolio_looks(id) on delete cascade,
  embedding extensions.vector(512) not null,
  model text not null,
  updated_at timestamptz not null default now()
);
alter table public.look_embeddings enable row level security;
-- No client policies: only the backend service role may manage embeddings.
create index if not exists look_embeddings_cosine_idx on public.look_embeddings using hnsw (embedding extensions.vector_cosine_ops);
create or replace function public.match_nail_looks(query_embedding extensions.vector(512), result_limit integer default 30)
returns table (look_id uuid, similarity double precision)
language sql stable security definer set search_path = '' as $$
  select e.look_id, (1 - (e.embedding OPERATOR(extensions.<=>) query_embedding))::double precision as similarity
  from public.look_embeddings e join public.portfolio_looks l on l.id = e.look_id
  where l.published = true and e.model = 'ViT-B-32-laion2b_s34b_b79k'
  order by e.embedding OPERATOR(extensions.<=>) query_embedding
  limit least(greatest(result_limit, 1), 50)
$$;
revoke all on function public.match_nail_looks(extensions.vector, integer) from public;
grant execute on function public.match_nail_looks(extensions.vector, integer) to service_role;
