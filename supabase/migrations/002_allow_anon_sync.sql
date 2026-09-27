-- TutorGrid Migration 002: Multi-Device Sync & Full Access Permissions
-- Run this in your Supabase SQL Editor to enable seamless sync across Mobile and Desktop

-- 1. Grant public schema access to anon and authenticated roles
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all routines in schema public to anon, authenticated, service_role;

alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on routines to anon, authenticated, service_role;

-- 2. Ensure RLS policies allow both anon and authenticated users
do $$ declare t text; begin
 foreach t in array array['students','schedules','schedule_exceptions','lesson_logs','tasks','payments','student_files','app_settings','push_subscriptions'] loop
   -- Enable RLS if not already enabled
   execute format('alter table if exists public.%I enable row level security', t);
   -- Remove old restrictive policies
   execute format('drop policy if exists authenticated_all on public.%I', t);
   execute format('drop policy if exists anon_all on public.%I', t);
   execute format('drop policy if exists public_all on public.%I', t);
   -- Create open permissive policy for full sync across desktop and mobile
   execute format('create policy public_all on public.%I for all to public using (true) with check (true)', t);
 end loop;
end $$;

-- 3. Storage bucket access for both anon and authenticated
insert into storage.buckets(id,name,public) values ('student-files','student-files',true) 
on conflict(id) do update set public = true;

drop policy if exists student_files_auth on storage.objects;
drop policy if exists student_files_anon on storage.objects;
drop policy if exists student_files_public on storage.objects;

create policy student_files_public on storage.objects for all to public 
using (bucket_id='student-files') 
with check (bucket_id='student-files');
