create table if not exists public.feedback_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('feature','bug','improvement','other')),
  title text not null check (char_length(title) between 1 and 120),
  status text not null default 'sent' check (status in ('sent','seen','replied','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists feedback_threads_user_updated_idx
  on public.feedback_threads (user_id, updated_at desc);

create table if not exists public.feedback_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.feedback_threads(id) on delete cascade,
  sender_type text not null check (sender_type in ('user','admin')),
  sender_id uuid references auth.users(id) on delete set null,
  message text not null check (char_length(message) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists feedback_messages_thread_created_idx
  on public.feedback_messages (thread_id, created_at);

alter table public.feedback_threads enable row level security;
alter table public.feedback_messages enable row level security;

grant select, insert on table public.feedback_threads to authenticated;
grant select, insert on table public.feedback_messages to authenticated;
grant select, insert, update, delete on table public.feedback_threads to service_role;
grant select, insert, update, delete on table public.feedback_messages to service_role;

create policy "Users can read own feedback threads"
  on public.feedback_threads
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create own feedback threads"
  on public.feedback_threads
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can read messages from own feedback threads"
  on public.feedback_messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.feedback_threads t
      where t.id = feedback_messages.thread_id
        and t.user_id = (select auth.uid())
    )
  );

create policy "Users can send messages in own feedback threads"
  on public.feedback_messages
  for insert
  to authenticated
  with check (
    sender_type = 'user'
    and sender_id = (select auth.uid())
    and exists (
      select 1
      from public.feedback_threads t
      where t.id = feedback_messages.thread_id
        and t.user_id = (select auth.uid())
        and t.status <> 'closed'
    )
  );
