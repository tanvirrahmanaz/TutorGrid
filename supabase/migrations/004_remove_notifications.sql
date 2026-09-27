-- Remove the unused notification/reminder stack.

drop table if exists public.push_subscriptions;

alter table if exists public.app_settings
  drop column if exists reminder_minutes;
