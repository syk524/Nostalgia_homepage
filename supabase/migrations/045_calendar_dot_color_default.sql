-- Match the app's new default point color for new calendar events.
alter table public.calendar_events alter column dot_color set default '#5B574E';
