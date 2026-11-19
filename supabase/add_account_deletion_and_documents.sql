-- Run this once in the Supabase SQL Editor (same project as the web app).
-- Safe to re-run. Adds:
--   1. delete_my_account(): lets a signed-in user permanently delete their
--      own account from inside the app (required by App Store Guideline
--      5.1.1(v) for any app that offers account creation).
--   2. trips.documents + a PRIVATE "trip-documents" storage bucket, for
--      booking confirmations, tickets, passport scans, etc.

-- 1. Account deletion -------------------------------------------------------
-- Deleting the auth.users row cascades to public.trips (trips.user_id is
-- "on delete cascade" in schema.sql). Storage files can't be deleted from
-- SQL (Supabase blocks direct deletes on storage.objects), so the app
-- removes the user's avatar + documents through the Storage API first,
-- then calls this.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  delete from public.trips where user_id = uid;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- 2. Trip documents ---------------------------------------------------------
-- Metadata (title, confirmation number, notes, file path) lives on the trip
-- row like itinerary/budget/packing do, so it's covered by the existing
-- trips RLS policies and is available offline from the cached trip.
alter table public.trips add column if not exists documents jsonb not null default '[]';

-- Files are private: path is "<user id>/<trip id>/<file>", and only the
-- owner can read/write anything under their own user-id folder. The app
-- reads them through short-lived signed URLs, never public ones.
insert into storage.buckets (id, name, public, file_size_limit)
values ('trip-documents', 'trip-documents', false, 10485760)
on conflict (id) do nothing;

drop policy if exists "trip_docs_select_own" on storage.objects;
drop policy if exists "trip_docs_insert_own" on storage.objects;
drop policy if exists "trip_docs_update_own" on storage.objects;
drop policy if exists "trip_docs_delete_own" on storage.objects;

create policy "trip_docs_select_own" on storage.objects
  for select using (bucket_id = 'trip-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "trip_docs_insert_own" on storage.objects
  for insert with check (bucket_id = 'trip-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "trip_docs_update_own" on storage.objects
  for update using (bucket_id = 'trip-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "trip_docs_delete_own" on storage.objects
  for delete using (bucket_id = 'trip-documents' and (storage.foldername(name))[1] = auth.uid()::text);
