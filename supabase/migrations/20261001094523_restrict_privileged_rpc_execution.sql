revoke execute on function public.create_profile_for_user() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

revoke execute on function public.match_nail_looks(extensions.vector, integer) from public, anon, authenticated;
grant execute on function public.match_nail_looks(extensions.vector, integer) to service_role;

revoke execute on function public.set_booking_status(uuid, text) from public, anon;
grant execute on function public.set_booking_status(uuid, text) to authenticated;
