create policy "Admins can delete feedback threads"
  on public.feedback_threads
  for delete
  to authenticated
  using (coalesce((select auth.jwt() -> 'app_metadata' ->> 'admin')::boolean, false));

grant delete on table public.feedback_threads to authenticated;
