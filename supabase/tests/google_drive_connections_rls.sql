-- RLS isolation test for public.google_drive_connections.
-- Run in the Supabase SQL Editor. Needs at least two users in Authentication -> Users.
-- Everything is rolled back at the end, so no data is left behind.
-- Expected result: rows_visible_to_a = 1, b_rows_visible_to_a = 0, b_rows_updated_by_a = 0
begin;

select set_config('app.user_a', (select id::text from auth.users order by created_at asc  limit 1), true);
select set_config('app.user_b', (select id::text from auth.users order by created_at desc limit 1), true);

-- Insert one fake row per user as the owner role (bypasses RLS).
insert into public.google_drive_connections (user_id, refresh_token_enc, scopes)
select id, 'v1.test', 'drive.file'
from auth.users
where id in (current_setting('app.user_a')::uuid, current_setting('app.user_b')::uuid);

-- Act as user A.
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('app.user_a'), 'role', 'authenticated')::text, true);

with attempt as (
  update public.google_drive_connections
  set folder_name = 'tampered'
  where user_id = current_setting('app.user_b')::uuid
  returning 1
)
select
  (select count(*) from public.google_drive_connections) as rows_visible_to_a,
  (select count(*) from public.google_drive_connections
     where user_id = current_setting('app.user_b')::uuid) as b_rows_visible_to_a,
  (select count(*) from attempt) as b_rows_updated_by_a;

rollback;
