update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('admin', true)
where lower(email)=lower('svetoslavov.plamen@gmail.com');

create policy "Admins can read all feedback threads"
  on public.feedback_threads
  for select
  to authenticated
  using (coalesce((select auth.jwt() -> 'app_metadata' ->> 'admin')::boolean, false));

create policy "Admins can update feedback threads"
  on public.feedback_threads
  for update
  to authenticated
  using (coalesce((select auth.jwt() -> 'app_metadata' ->> 'admin')::boolean, false))
  with check (coalesce((select auth.jwt() -> 'app_metadata' ->> 'admin')::boolean, false));

create policy "Admins can read all feedback messages"
  on public.feedback_messages
  for select
  to authenticated
  using (coalesce((select auth.jwt() -> 'app_metadata' ->> 'admin')::boolean, false));

create policy "Admins can reply to feedback threads"
  on public.feedback_messages
  for insert
  to authenticated
  with check (
    coalesce((select auth.jwt() -> 'app_metadata' ->> 'admin')::boolean, false)
    and sender_type = 'admin'
    and sender_id = (select auth.uid())
  );

grant update on table public.feedback_threads to authenticated;
