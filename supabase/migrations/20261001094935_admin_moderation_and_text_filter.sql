create policy "Admins can read all looks"
on public.portfolio_looks for select
to authenticated
using (coalesce((((select auth.jwt()) -> 'app_metadata' ->> 'admin'))::boolean, false));

create policy "Admins can moderate looks"
on public.portfolio_looks for update
to authenticated
using (coalesce((((select auth.jwt()) -> 'app_metadata' ->> 'admin'))::boolean, false))
with check (coalesce((((select auth.jwt()) -> 'app_metadata' ->> 'admin'))::boolean, false));

create policy "Admins can read all ratings"
on public.booking_ratings for select
to authenticated
using (coalesce((((select auth.jwt()) -> 'app_metadata' ->> 'admin'))::boolean, false));

create policy "Admins can delete ratings"
on public.booking_ratings for delete
to authenticated
using (coalesce((((select auth.jwt()) -> 'app_metadata' ->> 'admin'))::boolean, false));

grant update on table public.portfolio_looks to authenticated;
grant delete on table public.booking_ratings to authenticated;

create table if not exists private.content_filter_terms (
  term text primary key,
  created_at timestamptz not null default now()
);

insert into private.content_filter_terms(term) values
  ('kill yourself'),
  ('child porn'),
  ('heil hitler'),
  ('white power'),
  ('nigger'),
  ('faggot')
on conflict do nothing;

create or replace function private.assert_safe_text(value text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized text := lower(coalesce(value, ''));
  hit text;
begin
  select term into hit
  from private.content_filter_terms
  where normalized like '%' || term || '%'
  limit 1;

  if hit is not null then
    raise exception using
      errcode = '22023',
      message = 'This text contains language that is not allowed on Nailly.';
  end if;
end;
$$;

revoke all on function private.assert_safe_text(text) from public, anon, authenticated;

create or replace function private.filter_public_text_content()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'profiles' then
    perform private.assert_safe_text(new.display_name);
    perform private.assert_safe_text(new.bio);
  elsif tg_table_name = 'studios' then
    perform private.assert_safe_text(new.name);
    perform private.assert_safe_text(new.bio);
  elsif tg_table_name = 'portfolio_looks' then
    perform private.assert_safe_text(new.title);
  elsif tg_table_name = 'booking_ratings' then
    perform private.assert_safe_text(new.comment);
  end if;
  return new;
end;
$$;

revoke all on function private.filter_public_text_content() from public, anon, authenticated;

drop trigger if exists filter_profiles_public_text on public.profiles;
create trigger filter_profiles_public_text
before insert or update of display_name, bio on public.profiles
for each row execute function private.filter_public_text_content();

drop trigger if exists filter_studios_public_text on public.studios;
create trigger filter_studios_public_text
before insert or update of name, bio on public.studios
for each row execute function private.filter_public_text_content();

drop trigger if exists filter_looks_public_text on public.portfolio_looks;
create trigger filter_looks_public_text
before insert or update of title on public.portfolio_looks
for each row execute function private.filter_public_text_content();

drop trigger if exists filter_ratings_public_text on public.booking_ratings;
create trigger filter_ratings_public_text
before insert or update of comment on public.booking_ratings
for each row execute function private.filter_public_text_content();
