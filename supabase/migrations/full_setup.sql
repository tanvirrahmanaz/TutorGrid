-- ==============================================================================
-- TutorGrid COMPLETE DATABASE SETUP (Run this in Supabase SQL Editor)
-- ==============================================================================

-- 1. Enable pgcrypto extension for UUID generation
create extension if not exists pgcrypto;

-- 2. Create tables
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject text not null default '',
  phone text,
  notes text,
  color text not null default '#4f46e5',
  monthly_fee numeric(12,2) not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.schedules (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  day_of_week int not null check(day_of_week between 0 and 6), -- 0 Saturday, 6 Friday
  start_time time not null,
  duration_minutes int not null default 60 check(duration_minutes > 0),
  recurrence text not null default 'weekly',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.schedule_exceptions (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid references public.schedules(id) on delete set null,
  student_id uuid not null references public.students(id) on delete cascade,
  class_date date not null,
  start_time time not null,
  duration_minutes int not null default 60,
  status text not null check(status in ('scheduled','off','cancelled','rescheduled','missed','completed','absent')),
  original_date date,
  note text,
  created_at timestamptz not null default now(),
  unique(student_id,class_date,start_time)
);

create table if not exists public.lesson_logs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  class_date date not null,
  homework_assigned text,
  next_lesson text,
  lesson_note text,
  attendance_status text,
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  student_id uuid references public.students(id) on delete set null,
  class_date date,
  due_at timestamptz,
  priority text not null default 'medium' check(priority in ('low','medium','high')),
  status text not null default 'todo' check(status in ('todo','in_progress','done')),
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  month_key text not null,
  amount numeric(12,2) not null check(amount >= 0),
  note text,
  paid_at timestamptz not null default now()
);

create table if not exists public.student_files (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  mime_type text,
  created_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  id text primary key default 'default',
  day_start time not null default '07:00',
  day_end time not null default '22:00',
  interval_minutes int not null default 30,
  default_duration_minutes int not null default 60,
  reminder_minutes int not null default 30
);
insert into public.app_settings(id) values ('default') on conflict(id) do nothing;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- 3. Grant private single-admin app access to authenticated users only.
grant usage on schema public to authenticated, service_role;
grant all on all tables in schema public to authenticated, service_role;
grant all on all sequences in schema public to authenticated, service_role;
grant all on all routines in schema public to authenticated, service_role;
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all routines in schema public from anon;

alter default privileges in schema public grant all on tables to authenticated, service_role;
alter default privileges in schema public grant all on sequences to authenticated, service_role;
alter default privileges in schema public grant all on routines to authenticated, service_role;

-- 4. Enable RLS and allow only signed-in users.
do $$ declare t text; begin
 foreach t in array array['students','schedules','schedule_exceptions','lesson_logs','tasks','payments','student_files','app_settings','push_subscriptions'] loop
   execute format('alter table if exists public.%I enable row level security', t);
   execute format('drop policy if exists authenticated_all on public.%I', t);
   execute format('drop policy if exists anon_all on public.%I', t);
   execute format('drop policy if exists public_all on public.%I', t);
   execute format('create policy authenticated_all on public.%I for all to authenticated using (true) with check (true)', t);
 end loop;
end $$;

-- 5. Storage bucket setup
insert into storage.buckets(id,name,public) values ('student-files','student-files',false)
on conflict(id) do update set public = false;

drop policy if exists student_files_auth on storage.objects;
drop policy if exists student_files_anon on storage.objects;
drop policy if exists student_files_public on storage.objects;

create policy student_files_auth on storage.objects for all to authenticated
using (bucket_id='student-files') 
with check (bucket_id='student-files');
