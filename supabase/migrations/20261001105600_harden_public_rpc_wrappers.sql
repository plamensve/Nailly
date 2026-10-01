create schema if not exists private;

create or replace function private.available_slots_impl(for_studio uuid)
returns table(id uuid, studio_id uuid, starts_at timestamptz, ends_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select a.id, a.studio_id, a.starts_at, a.ends_at
  from public.availability_slots a
  where a.studio_id = for_studio
    and a.starts_at > now()
    and not exists (
      select 1 from public.bookings b
      where b.slot_id = a.id and b.status in ('requested','confirmed')
    )
  order by a.starts_at limit 60
$$;

create or replace function private.client_rating_impl(for_client uuid)
returns table(avg_rating numeric, rating_count bigint)
language sql stable security definer set search_path = ''
as $$
  select round(avg(br.rating)::numeric, 2), count(*)
  from public.booking_ratings br
  join public.bookings b on b.id = br.booking_id
  where br.target_type = 'client' and b.client_id = for_client
$$;

create or replace function private.studio_rating_impl(for_studio uuid)
returns table(avg_rating numeric, rating_count bigint)
language sql stable security definer set search_path = ''
as $$
  select round(avg(br.rating)::numeric, 2), count(*)
  from public.booking_ratings br
  join public.bookings b on b.id = br.booking_id
  where br.target_type = 'studio' and b.studio_id = for_studio
$$;

create or replace function private.studio_ratings_for_ids_impl(for_studios uuid[])
returns table(studio_id uuid, avg_rating numeric, rating_count bigint)
language sql stable security definer set search_path = ''
as $$
  select s.id, round(avg(br.rating)::numeric, 2), count(br.id)
  from unnest(for_studios) as x(studio_id)
  join public.studios s on s.id = x.studio_id
  left join public.bookings b on b.studio_id = s.id
  left join public.booking_ratings br on br.booking_id = b.id and br.target_type = 'studio'
  group by s.id
$$;

create or replace function private.studio_reviews_impl(for_studio uuid, review_limit integer default 10)
returns table(booking_id uuid, rating smallint, comment text, created_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select br.booking_id, br.rating, br.comment, br.created_at
  from public.booking_ratings br
  join public.bookings b on b.id = br.booking_id
  where br.target_type = 'studio'
    and b.studio_id = for_studio
    and nullif(trim(br.comment), '') is not null
  order by br.created_at desc
  limit greatest(1, least(review_limit, 50))
$$;

create or replace function private.set_booking_status_impl(booking_id uuid, next_status text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  b public.bookings;
  caller uuid := (select auth.uid());
begin
  if caller is null then raise exception 'Authentication required'; end if;

  select * into b from public.bookings where id = booking_id for update;
  if not found then raise exception 'Booking not found'; end if;

  if next_status = 'cancelled'
     and (b.client_id = caller or exists (
       select 1 from public.studios s where s.id = b.studio_id and s.owner_id = caller
     ))
     and b.status in ('requested','confirmed') then
    update public.bookings set status = 'cancelled' where id = booking_id;
  elsif next_status = 'confirmed'
     and b.status = 'requested'
     and exists (
       select 1 from public.studios s where s.id = b.studio_id and s.owner_id = caller
     ) then
    update public.bookings set status = 'confirmed' where id = booking_id;
  else
    raise exception 'Not allowed';
  end if;
end
$$;

revoke all on function private.available_slots_impl(uuid) from public, anon;
revoke all on function private.client_rating_impl(uuid) from public, anon;
revoke all on function private.studio_rating_impl(uuid) from public, anon;
revoke all on function private.studio_ratings_for_ids_impl(uuid[]) from public, anon;
revoke all on function private.studio_reviews_impl(uuid, integer) from public, anon;
revoke all on function private.set_booking_status_impl(uuid, text) from public, anon;

grant usage on schema private to authenticated, service_role;
grant execute on function private.available_slots_impl(uuid) to authenticated, service_role;
grant execute on function private.client_rating_impl(uuid) to authenticated, service_role;
grant execute on function private.studio_rating_impl(uuid) to authenticated, service_role;
grant execute on function private.studio_ratings_for_ids_impl(uuid[]) to authenticated, service_role;
grant execute on function private.studio_reviews_impl(uuid, integer) to authenticated, service_role;
grant execute on function private.set_booking_status_impl(uuid, text) to authenticated, service_role;

create or replace function public.available_slots(for_studio uuid)
returns table(id uuid, studio_id uuid, starts_at timestamptz, ends_at timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from private.available_slots_impl(for_studio) $$;

create or replace function public.client_rating(for_client uuid)
returns table(avg_rating numeric, rating_count bigint)
language sql stable security invoker set search_path = ''
as $$ select * from private.client_rating_impl(for_client) $$;

create or replace function public.studio_rating(for_studio uuid)
returns table(avg_rating numeric, rating_count bigint)
language sql stable security invoker set search_path = ''
as $$ select * from private.studio_rating_impl(for_studio) $$;

create or replace function public.studio_ratings_for_ids(for_studios uuid[])
returns table(studio_id uuid, avg_rating numeric, rating_count bigint)
language sql stable security invoker set search_path = ''
as $$ select * from private.studio_ratings_for_ids_impl(for_studios) $$;

create or replace function public.studio_reviews(for_studio uuid, review_limit integer default 10)
returns table(booking_id uuid, rating smallint, comment text, created_at timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from private.studio_reviews_impl(for_studio, review_limit) $$;

create or replace function public.set_booking_status(booking_id uuid, next_status text)
returns void
language sql security invoker set search_path = ''
as $$ select private.set_booking_status_impl(booking_id, next_status) $$;

revoke all on function public.available_slots(uuid) from public, anon;
revoke all on function public.client_rating(uuid) from public, anon;
revoke all on function public.studio_rating(uuid) from public, anon;
revoke all on function public.studio_ratings_for_ids(uuid[]) from public, anon;
revoke all on function public.studio_reviews(uuid, integer) from public, anon;
revoke all on function public.set_booking_status(uuid, text) from public, anon;

grant execute on function public.available_slots(uuid) to authenticated, service_role;
grant execute on function public.client_rating(uuid) to authenticated, service_role;
grant execute on function public.studio_rating(uuid) to authenticated, service_role;
grant execute on function public.studio_ratings_for_ids(uuid[]) to authenticated, service_role;
grant execute on function public.studio_reviews(uuid, integer) to authenticated, service_role;
grant execute on function public.set_booking_status(uuid, text) to authenticated, service_role;
