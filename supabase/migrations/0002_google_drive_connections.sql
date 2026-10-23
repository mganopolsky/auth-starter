-- One Google Drive connection per user: the encrypted refresh token and the chosen folder.
-- refresh_token_enc holds ciphertext only (AES-256-GCM, encrypted by the app with a server-only key).
create table public.google_drive_connections (
  user_id uuid primary key references auth.users (id) on delete cascade,
  refresh_token_enc text not null,
  scopes text not null,
  folder_id text,
  folder_name text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint folder_id_format check (folder_id is null or folder_id ~ '^[A-Za-z0-9_-]{10,100}$')
);

alter table public.google_drive_connections enable row level security;

create policy "Users can view their own drive connection"
  on public.google_drive_connections for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own drive connection"
  on public.google_drive_connections for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own drive connection"
  on public.google_drive_connections for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own drive connection"
  on public.google_drive_connections for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Keep updated_at current. Empty search_path per Supabase guidance for functions.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger google_drive_connections_set_updated_at
  before update on public.google_drive_connections
  for each row execute function public.set_updated_at();
