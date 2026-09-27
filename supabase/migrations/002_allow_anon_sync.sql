-- Deprecated filename kept for compatibility.
-- TutorGrid must not grant anon write access in production.
-- This migration now preserves private authenticated-only access.

grant usage on schema public to authenticated, service_role;
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all routines in schema public from anon;

grant all on all tables in schema public to authenticated, service_role;
grant all on all sequences in schema public to authenticated, service_role;
grant all on all routines in schema public to authenticated, service_role;

do $$ declare t text; begin
 foreach t in array array['students','schedules','schedule_exceptions','lesson_logs','tasks','payments','student_files','app_settings'] loop
   execute format('alter table if exists public.%I enable row level security', t);
   execute format('drop policy if exists public_all on public.%I', t);
   execute format('drop policy if exists anon_all on public.%I', t);
   execute format('drop policy if exists authenticated_all on public.%I', t);
   execute format('create policy authenticated_all on public.%I for all to authenticated using (true) with check (true)', t);
 end loop;
end $$;

update storage.buckets set public = false where id = 'student-files';

drop policy if exists student_files_public on storage.objects;
drop policy if exists student_files_anon on storage.objects;
drop policy if exists student_files_auth on storage.objects;

create policy student_files_auth on storage.objects for all to authenticated
using (bucket_id='student-files')
with check (bucket_id='student-files');
