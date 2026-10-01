create table if not exists public.blocked_users (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table public.blocked_users enable row level security;

create policy "Users can read own blocks"
on public.blocked_users for select
to authenticated
using ((select auth.uid()) = blocker_id);

create policy "Users can block users"
on public.blocked_users for insert
to authenticated
with check ((select auth.uid()) = blocker_id and (select auth.uid()) <> blocked_id);

create policy "Users can unblock users"
on public.blocked_users for delete
to authenticated
using ((select auth.uid()) = blocker_id);

grant select, insert, delete on table public.blocked_users to authenticated;

create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reported_user_id uuid references auth.users(id) on delete set null,
  target_type text not null check (target_type in ('design','studio','review','profile')),
  target_id uuid not null,
  reason text not null check (reason in ('inappropriate','harassment','spam','copyright','other')),
  details text not null default '' check (char_length(details) <= 1000),
  status text not null default 'pending' check (status in ('pending','reviewed','dismissed','actioned')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists content_reports_status_created_idx on public.content_reports(status, created_at desc);
create index if not exists content_reports_reported_user_idx on public.content_reports(reported_user_id) where reported_user_id is not null;

alter table public.content_reports enable row level security;

create policy "Users can create reports"
on public.content_reports for insert
to authenticated
with check ((select auth.uid()) = reporter_id);

create policy "Users can read own reports"
on public.content_reports for select
to authenticated
using ((select auth.uid()) = reporter_id);

create policy "Admins can read reports"
on public.content_reports for select
to authenticated
using (coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'admin')::boolean, false));

create policy "Admins can update reports"
on public.content_reports for update
to authenticated
using (coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'admin')::boolean, false))
with check (coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'admin')::boolean, false));

grant select, insert, update on table public.content_reports to authenticated;
