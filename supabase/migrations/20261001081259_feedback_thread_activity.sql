create schema if not exists private;

create or replace function private.touch_feedback_thread()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.feedback_threads
  set updated_at = now(),
      status = case
        when new.sender_type = 'admin' then 'replied'
        when status = 'closed' then status
        else 'sent'
      end
  where id = new.thread_id;
  return new;
end;
$$;

revoke all on function private.touch_feedback_thread() from public, anon, authenticated;

drop trigger if exists feedback_message_touch_thread on public.feedback_messages;
create trigger feedback_message_touch_thread
after insert on public.feedback_messages
for each row execute function private.touch_feedback_thread();

create index if not exists feedback_messages_sender_id_idx
  on public.feedback_messages (sender_id)
  where sender_id is not null;
