create policy "Admins can read all profiles"
  on public.profiles
  for select
  to authenticated
  using (coalesce((select auth.jwt() -> 'app_metadata' ->> 'admin')::boolean, false));
