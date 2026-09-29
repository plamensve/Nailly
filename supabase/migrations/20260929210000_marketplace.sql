-- Apply after 20260929180000_initial.sql. All public tables use RLS.
create or replace function public.create_profile_for_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, display_name, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''),
    case when new.raw_user_meta_data ->> 'role' = 'artist' then 'artist' else 'client' end)
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created_nailly on auth.users;
create trigger on_auth_user_created_nailly after insert on auth.users for each row execute procedure public.create_profile_for_user();

alter table public.studios add column if not exists bio text not null default '';
alter table public.studios add column if not exists phone text;
create unique index if not exists one_studio_per_owner on public.studios(owner_id);
create table if not exists public.availability_slots (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint slot_duration check (ends_at > starts_at),
  unique (studio_id, starts_at)
);
alter table public.availability_slots enable row level security;
create policy "slots public read" on public.availability_slots for select to anon, authenticated using (true);
create policy "slots owner insert" on public.availability_slots for insert to authenticated with check (
  starts_at > now() and exists (select 1 from public.studios s where s.id = studio_id and s.owner_id = auth.uid()));
create policy "slots owner delete" on public.availability_slots for delete to authenticated using (
  exists (select 1 from public.studios s where s.id = studio_id and s.owner_id = auth.uid()));

alter table public.bookings add column if not exists slot_id uuid references public.availability_slots(id) on delete restrict;
alter table public.bookings add column if not exists client_name text not null default '';
create unique index if not exists one_active_booking_per_slot on public.bookings(slot_id) where status in ('requested','confirmed');
drop policy if exists "bookings client request" on public.bookings;
create policy "bookings client request" on public.bookings for insert to authenticated with check (
  client_id = auth.uid() and status = 'requested' and slot_id is not null and starts_at > now() and
  exists (select 1 from public.availability_slots a where a.id = slot_id and a.studio_id = studio_id and a.starts_at = starts_at));

create or replace function public.set_booking_status(booking_id uuid, next_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare b public.bookings;
begin
  select * into b from public.bookings where id = booking_id for update;
  if not found then raise exception 'Booking not found'; end if;
  if next_status = 'cancelled' and (b.client_id = auth.uid() or exists
      (select 1 from public.studios s where s.id = b.studio_id and s.owner_id = auth.uid()))
      and b.status in ('requested','confirmed') then
    update public.bookings set status = 'cancelled' where id = booking_id;
  elsif next_status = 'confirmed' and b.status = 'requested' and exists
      (select 1 from public.studios s where s.id = b.studio_id and s.owner_id = auth.uid()) then
    update public.bookings set status = 'confirmed' where id = booking_id;
  else raise exception 'Not allowed'; end if;
end $$;
revoke all on function public.set_booking_status(uuid,text) from public;
grant execute on function public.set_booking_status(uuid,text) to authenticated;

create table if not exists public.saved_looks (
  user_id uuid not null references auth.users(id) on delete cascade,
  look_id uuid not null references public.portfolio_looks(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, look_id)
);
alter table public.saved_looks enable row level security;
create policy "saved own read" on public.saved_looks for select to authenticated using (user_id = auth.uid());
create policy "saved own insert" on public.saved_looks for insert to authenticated with check (user_id = auth.uid());
create policy "saved own delete" on public.saved_looks for delete to authenticated using (user_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portfolio', 'portfolio', true, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
create policy "portfolio public read" on storage.objects for select to anon, authenticated using (bucket_id = 'portfolio');
create policy "studio owner upload" on storage.objects for insert to authenticated with check (
  bucket_id = 'portfolio' and exists (
    select 1 from public.studios s where s.id::text = (storage.foldername(name))[1] and s.owner_id = auth.uid()));
create policy "studio owner delete image" on storage.objects for delete to authenticated using (
  bucket_id = 'portfolio' and exists (
    select 1 from public.studios s where s.id::text = (storage.foldername(name))[1] and s.owner_id = auth.uid()));

create or replace function public.available_slots(for_studio uuid)
returns table (id uuid, studio_id uuid, starts_at timestamptz, ends_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select a.id, a.studio_id, a.starts_at, a.ends_at
  from public.availability_slots a
  where a.studio_id = for_studio and a.starts_at > now()
    and not exists (select 1 from public.bookings b where b.slot_id = a.id and b.status in ('requested','confirmed'))
  order by a.starts_at limit 60
$$;
revoke all on function public.available_slots(uuid) from public;
grant execute on function public.available_slots(uuid) to anon, authenticated;

-- Accounts created before this migration receive a profile as well.
insert into public.profiles (id, display_name, role)
select u.id, coalesce(u.raw_user_meta_data ->> 'display_name', ''),
  case when u.raw_user_meta_data ->> 'role' = 'artist' then 'artist' else 'client' end
from auth.users u where true on conflict (id) do nothing;
