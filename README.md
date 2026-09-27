# TutorGrid

TutorGrid is a responsive tutoring schedule and student-management PWA built for a single tutor/admin.

## Included

- Username-style admin login backed by Supabase Auth (`admin` maps to `NEXT_PUBLIC_ADMIN_EMAIL`)
- Password change from Settings
- Dashboard summary: students, today classes, tasks, monthly dues, attendance prompts
- Weekly Saturday→Friday calendar with actual dates
- Configurable day start/end, time interval and default duration
- Recurring weekly student schedules
- Per-date exceptions: off, cancelled, missed, rescheduled, completed, absent
- Drag/drop or click-to-move class to an empty slot
- Earliest-free-slot suggestion in the visible week
- Conflict warning (red outline) while still allowing overlaps
- Student profiles, subject, color, monthly fee, notes, archive
- Date-wise lesson log: what was taught, homework, next lesson, attendance status
- Multiple syllabus/file uploads using Supabase Storage
- General or student-linked tasks with priority/status/due date
- Monthly BDT payment ledger with Paid/Partial/Due calculation
- Installable PWA for desktop/mobile
- Demo/local mode when Supabase env is not configured

## 1. Install

```bash
npm install
cp .env.example .env.local
npm run dev
```

Without Supabase configured, demo mode works only when you explicitly set local demo credentials:

```env
NEXT_PUBLIC_ADMIN_EMAIL=admin@tutorgrid.local
NEXT_PUBLIC_DEMO_PASSWORD=your-local-demo-password
```

For deployment, configure Supabase Auth so the production password is never hard-coded in the frontend.

## 2. Create Supabase project

Open Supabase SQL Editor and run:

1. `supabase/migrations/001_tutorgrid.sql`
2. optionally `supabase/seed.sql`

Then create one Supabase Auth user with your own strong password:

- Email: `admin@tutorgrid.local` (or your own value)
- Password: create a private password in Supabase Auth

Set the same email in `NEXT_PUBLIC_ADMIN_EMAIL`. The login form still shows username `admin`.

## 3. Environment variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_ADMIN_USERNAME=admin
NEXT_PUBLIC_ADMIN_EMAIL=admin@tutorgrid.local
NEXT_PUBLIC_DEMO_PASSWORD=only-for-local-demo-without-supabase
```

Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser.

## 4. Deploy to Vercel

1. Push this folder to GitHub.
2. Import repository into Vercel.
3. Add all environment variables.
4. Deploy.
5. Use browser **Install app / Add to Home Screen** to install TutorGrid.

## Current starter schedule

The optional seed includes only rows whose times were unambiguous from the supplied schedule: Arman, Mridila, Erina, Zihad, Siyam, Raza, Nayeem and Rudro. Sathi/Shafin/Sharafat/Tasin/Shovon are created as students but their uncertain time rows are intentionally not invented; add them through the UI after confirming the exact times.

## Data model

Core tables:

- `students`
- `schedules`
- `schedule_exceptions`
- `lesson_logs`
- `tasks`
- `payments`
- `student_files`
- `app_settings`

Private syllabus files are stored in the `student-files` bucket.

## Production notes

- This app is designed as a private single-admin tool. RLS allows authenticated users to access the app data. Do not add extra Supabase Auth users unless you also revise the RLS policies for multi-user isolation.
- A single-day move creates schedule exceptions rather than modifying the recurring weekly schedule.
- Archive is used for student removal so history can be preserved.
- Conflict warnings do not block scheduling by design.
