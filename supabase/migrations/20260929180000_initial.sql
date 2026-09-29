-- Apply in Supabase SQL Editor after reviewing the schema. No sample studios are inserted.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  role text not null default 'client' check (role in ('client', 'artist')),
  created_at timestamptz not null default now()
);
create table if not exists public.studios (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  city text not null,
  address text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now()
);
create table if not exists public.portfolio_looks (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  title text not null,
  image_url text not null,
  price_eur numeric(9,2) check (price_eur >= 0),
  published boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists portfolio_looks_studio_idx on public.portfolio_looks(studio_id);
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references auth.users(id) on delete cascade,
  studio_id uuid not null references public.studios(id) on delete cascade,
  starts_at timestamptz not null,
  status text not null default 'requested' check (status in ('requested','confirmed','cancelled','completed')),
  created_at timestamptz not null default now()
);
create index if not exists bookings_studio_time_idx on public.bookings(studio_id, starts_at);

alter table public.profiles enable row level security;
alter table public.studios enable row level security;
alter table public.portfolio_looks enable row level security;
alter table public.bookings enable row level security;
create policy "profiles own read" on public.profiles for select to authenticated using (id = auth.uid());
create policy "profiles own insert" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "profiles own update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "studios public read" on public.studios for select to anon, authenticated using (true);
create policy "studios owner insert" on public.studios for insert to authenticated with check (owner_id = auth.uid());
create policy "studios owner update" on public.studios for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "looks public read" on public.portfolio_looks for select to anon, authenticated using (published or exists (select 1 from public.studios s where s.id = studio_id and s.owner_id = auth.uid()));
create policy "looks owner insert" on public.portfolio_looks for insert to authenticated with check (exists (select 1 from public.studios s where s.id = studio_id and s.owner_id = auth.uid()));
create policy "looks owner update" on public.portfolio_looks for update to authenticated using (exists (select 1 from public.studios s where s.id = studio_id and s.owner_id = auth.uid())) with check (exists (select 1 from public.studios s where s.id = studio_id and s.owner_id = auth.uid()));
create policy "bookings participants read" on public.bookings for select to authenticated using (client_id = auth.uid() or exists (select 1 from public.studios s where s.id = studio_id and s.owner_id = auth.uid()));
create policy "bookings client request" on public.bookings for insert to authenticated with check (client_id = auth.uid() and status = 'requested' and starts_at > now());
-- Booking updates and image uploads will be introduced with availability and moderation rules.
