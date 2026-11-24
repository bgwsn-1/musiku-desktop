create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  updated_at timestamptz not null default now()
);

create table if not exists public.liked_tracks (
  user_id uuid not null references auth.users(id) on delete cascade,
  video_id text not null,
  position integer not null default 0,
  track jsonb not null,
  liked_at timestamptz not null default now(),
  primary key (user_id, video_id)
);

create table if not exists public.playlists (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  name text not null,
  created_at bigint not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.playlist_tracks (
  user_id uuid not null,
  playlist_id text not null,
  video_id text not null,
  position integer not null default 0,
  track jsonb not null,
  added_at timestamptz not null default now(),
  primary key (user_id, playlist_id, video_id),
  foreign key (user_id, playlist_id)
    references public.playlists(user_id, id)
    on delete cascade
);

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  recent jsonb not null default '[]'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists idx_liked_tracks_user_pos
  on public.liked_tracks (user_id, position);

create index if not exists idx_playlist_tracks_user_pl_pos
  on public.playlist_tracks (user_id, playlist_id, position);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_playlists_updated_at on public.playlists;
create trigger trg_playlists_updated_at
  before update on public.playlists
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_user_preferences_updated_at on public.user_preferences;
create trigger trg_user_preferences_updated_at
  before update on public.user_preferences
  for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      split_part(coalesce(new.email, ''), '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.liked_tracks enable row level security;
alter table public.playlists enable row level security;
alter table public.playlist_tracks enable row level security;
alter table public.user_preferences enable row level security;

create policy "profiles_select_own" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "liked_tracks_select_own" on public.liked_tracks
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "liked_tracks_insert_own" on public.liked_tracks
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "liked_tracks_update_own" on public.liked_tracks
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "liked_tracks_delete_own" on public.liked_tracks
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "playlists_select_own" on public.playlists
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "playlists_insert_own" on public.playlists
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "playlists_update_own" on public.playlists
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "playlists_delete_own" on public.playlists
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "playlist_tracks_select_own" on public.playlist_tracks
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "playlist_tracks_insert_own" on public.playlist_tracks
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "playlist_tracks_update_own" on public.playlist_tracks
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "playlist_tracks_delete_own" on public.playlist_tracks
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "user_preferences_select_own" on public.user_preferences
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "user_preferences_insert_own" on public.user_preferences
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "user_preferences_update_own" on public.user_preferences
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "user_preferences_delete_own" on public.user_preferences
  for delete to authenticated using ((select auth.uid()) = user_id);
