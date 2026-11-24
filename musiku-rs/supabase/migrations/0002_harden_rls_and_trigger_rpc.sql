alter policy "playlist_tracks_update_own" on public.playlist_tracks
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.touch_updated_at() from public, anon, authenticated;
