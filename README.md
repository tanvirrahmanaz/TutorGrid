# TutorGrid

TutorGrid is a responsive tutoring schedule and student-management PWA built for a single tutor/admin.

## Included

- Username-style admin login backed by Supabase Auth (`admin` maps to `NEXT_PUBLIC_ADMIN_EMAIL`)
- Password change from Settings
- Dashboard summary: students, today classes, tasks, monthly dues, attendance prompts
- Weekly Saturday→Friday calendar with actual dates
- Configurable day start/end, time interval, default duration and reminder time
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
- Browser push subscription + service worker + reminder cron endpoint
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
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
CRON_SECRET=long-random-secret
```

Never expose `SUPABASE_SERVICE_ROLE_KEY` or `VAPID_PRIVATE_KEY` to the browser.

## 4. Web Push / closed-app reminders

Generate VAPID keys, for example:

```bash
npx web-push generate-vapid-keys
```

Add the keys to Vercel. In TutorGrid Settings, click **Enable push notifications**.

`vercel.json` calls `/api/cron/reminders` every 5 minutes. Availability/frequency of Vercel Cron depends on your Vercel plan. If your plan does not support this cadence, point any trusted scheduler at the same endpoint and send:

```text
Authorization: Bearer YOUR_CRON_SECRET
```

The service worker receives the push and shows the notification when supported by the browser/OS, even while the PWA UI is not open.

## 5. Deploy to Vercel

1. Push this folder to GitHub.
2. Import repository into Vercel.
3. Add all environment variables.
4. Deploy.
5. Open the deployed HTTPS URL and allow notifications.
6. Use browser **Install app / Add to Home Screen** to install TutorGrid.

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
- `push_subscriptions`

Private syllabus files are stored in the `student-files` bucket.

## Production notes

- This app is designed as a private single-admin tool. RLS allows authenticated users to access the app data. Do not add extra Supabase Auth users unless you also revise the RLS policies for multi-user isolation.
- A single-day move creates schedule exceptions rather than modifying the recurring weekly schedule.
- Archive is used for student removal so history can be preserved.
- Conflict warnings do not block scheduling by design.
