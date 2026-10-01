create policy "deny client access to look embeddings"
on public.look_embeddings
for all to anon, authenticated
using (false) with check (false);

drop policy if exists "Admins can read all ratings" on public.booking_ratings;
drop policy if exists "ratings participants read" on public.booking_ratings;
create policy "ratings admin or participants read"
on public.booking_ratings for select to authenticated
using (
  coalesce((((select auth.jwt()) -> 'app_metadata' ->> 'admin'))::boolean, false)
  or exists (
    select 1 from public.bookings b
    join public.studios s on s.id = b.studio_id
    where b.id = booking_ratings.booking_id
      and (b.client_id = (select auth.uid()) or s.owner_id = (select auth.uid()))
  )
);

drop policy if exists "Admins can read reports" on public.content_reports;
drop policy if exists "Users can read own reports" on public.content_reports;
create policy "reports admin or own read"
on public.content_reports for select to authenticated
using (
  coalesce((((select auth.jwt()) -> 'app_metadata' ->> 'admin'))::boolean, false)
  or reporter_id = (select auth.uid())
);

drop policy if exists "Admins can read all feedback messages" on public.feedback_messages;
drop policy if exists "Users can read messages from own feedback threads" on public.feedback_messages;
create policy "feedback messages admin or owner read"
on public.feedback_messages for select to authenticated
using (
  coalesce((((select auth.jwt()) -> 'app_metadata' ->> 'admin'))::boolean, false)
  or exists (
    select 1 from public.feedback_threads t
    where t.id = feedback_messages.thread_id
      and t.user_id = (select auth.uid())
  )
);

drop policy if exists "Admins can reply to feedback threads" on public.feedback_messages;
drop policy if exists "Users can send messages in own feedback threads" on public.feedback_messages;
create policy "feedback messages admin or owner insert"
on public.feedback_messages for insert to authenticated
with check (
  (
    coalesce((((select auth.jwt()) -> 'app_metadata' ->> 'admin'))::boolean, false)
    and sender_type = 'admin'
    and sender_id = (select auth.uid())
  )
  or (
    sender_type = 'user'
    and sender_id = (select auth.uid())
    and exists (
      select 1 from public.feedback_threads t
      where t.id = feedback_messages.thread_id
        and t.user_id = (select auth.uid())
        and t.status <> 'closed'
    )
  )
);

drop policy if exists "Admins can read all feedback threads" on public.feedback_threads;
drop policy if exists "Users can read own feedback threads" on public.feedback_threads;
create policy "feedback threads admin or owner read"
on public.feedback_threads for select to authenticated
using (
  coalesce((((select auth.jwt()) -> 'app_metadata' ->> 'admin'))::boolean, false)
  or user_id = (select auth.uid())
);

drop policy if exists "Admins can read all looks" on public.portfolio_looks;
drop policy if exists "looks public read" on public.portfolio_looks;
create policy "looks anon published read"
on public.portfolio_looks for select to anon
using (published);

create policy "looks authenticated visible read"
on public.portfolio_looks for select to authenticated
using (
  published
  or coalesce((((select auth.jwt()) -> 'app_metadata' ->> 'admin'))::boolean, false)
  or exists (
    select 1 from public.studios s
    where s.id = portfolio_looks.studio_id
      and s.owner_id = (select auth.uid())
  )
);

drop policy if exists "Admins can moderate looks" on public.portfolio_looks;
drop policy if exists "looks owner update" on public.portfolio_looks;
create policy "looks admin or owner update"
on public.portfolio_looks for update to authenticated
using (
  coalesce((((select auth.jwt()) -> 'app_metadata' ->> 'admin'))::boolean, false)
  or exists (
    select 1 from public.studios s
    where s.id = portfolio_looks.studio_id
      and s.owner_id = (select auth.uid())
  )
)
with check (
  coalesce((((select auth.jwt()) -> 'app_metadata' ->> 'admin'))::boolean, false)
  or exists (
    select 1 from public.studios s
    where s.id = portfolio_looks.studio_id
      and s.owner_id = (select auth.uid())
  )
);

drop policy if exists "Admins can read all profiles" on public.profiles;
drop policy if exists "profiles own read" on public.profiles;
create policy "profiles admin or own read"
on public.profiles for select to authenticated
using (
  coalesce((((select auth.jwt()) -> 'app_metadata' ->> 'admin'))::boolean, false)
  or id = (select auth.uid())
);
