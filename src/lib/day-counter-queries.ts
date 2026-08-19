import { createClient } from '@/lib/supabase/server'
import type { DayCounter } from '@/types/database'

// A single global row — seeded once by migration 047, never inserted or
// deleted from the app itself, only ever updated.
export async function fetchDayCounter(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<DayCounter | null> {
  const { data } = await supabase.from('day_counter').select('*').limit(1).single()
  return data
}
