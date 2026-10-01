create index if not exists booking_ratings_rater_id_idx on public.booking_ratings (rater_id);
create index if not exists bookings_client_id_idx on public.bookings (client_id);
create index if not exists bookings_look_id_idx on public.bookings (look_id);
create index if not exists saved_looks_look_id_idx on public.saved_looks (look_id);

do $$
declare
  r record;
  new_qual text;
  new_check text;
  stmt text;
begin
  for r in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (
        coalesce(qual,'') ~ 'auth\.(uid|jwt)\(\)'
        or coalesce(with_check,'') ~ 'auth\.(uid|jwt)\(\)'
      )
  loop
    new_qual := r.qual;
    new_check := r.with_check;

    if new_qual is not null then
      new_qual := regexp_replace(new_qual, 'auth\.uid\(\)', '(select auth.uid())', 'g');
      new_qual := regexp_replace(new_qual, 'auth\.jwt\(\)', '(select auth.jwt())', 'g');
    end if;

    if new_check is not null then
      new_check := regexp_replace(new_check, 'auth\.uid\(\)', '(select auth.uid())', 'g');
      new_check := regexp_replace(new_check, 'auth\.jwt\(\)', '(select auth.jwt())', 'g');
    end if;

    stmt := format('alter policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
    if new_qual is not null then stmt := stmt || format(' using (%s)', new_qual); end if;
    if new_check is not null then stmt := stmt || format(' with check (%s)', new_check); end if;
    execute stmt;
  end loop;
end $$;
