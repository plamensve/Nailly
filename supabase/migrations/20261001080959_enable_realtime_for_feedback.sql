do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'feedback_threads'
  ) then
    alter publication supabase_realtime add table public.feedback_threads;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'feedback_messages'
  ) then
    alter publication supabase_realtime add table public.feedback_messages;
  end if;
end $$;
