import { createClient } from '@/lib/supabase/server'
import type { CalendarEvent } from '@/types/database'

// No date-range filter — RLS already does the filtering that matters
// (which visibility tiers this session can see); the event count for a
// personal site's calendar is small enough that fetching everything and
// paging by month client-side is simpler than a server round-trip per
// month navigation.
export async function fetchCalendarEvents(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<CalendarEvent[]> {
  const { data } = await supabase
    .from('calendar_events')
    .select('*')
    .order('event_date', { ascending: true })

  return data ?? []
}
