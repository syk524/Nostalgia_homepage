import { Settings, type LucideIcon } from 'lucide-react'

// Calendar and Day Counter aren't part of this list — they live on the
// desk as their own components (calendar-desk-widget.tsx,
// day-counter-desk-widget.tsx), morphing between icon and full panel in
// place, rather than opening a separate DockAppWindow like this
// placeholder still does.
export type DockApp = { id: string; label: string; icon: LucideIcon; requiresAuth?: boolean }

// Settings itself needs no account — a guest can open it and try any
// theme same as anyone else, it just won't be saved anywhere for them
// (updateTheme in lib/actions/theme.ts no-ops without a signed-in user,
// rather than writing a guest-only row nobody would ever read back).
export const DOCK_APPS: DockApp[] = [
  { id: 'settings', label: 'Settings', icon: Settings },
]
