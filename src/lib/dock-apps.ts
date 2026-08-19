import { Settings, type LucideIcon } from 'lucide-react'

// Calendar and Day Counter aren't part of this list — they live on the
// desk as their own components (calendar-desk-widget.tsx,
// day-counter-desk-widget.tsx), morphing between icon and full panel in
// place, rather than opening a separate DockAppWindow like this
// placeholder still does.
export type DockApp = { id: string; label: string; icon: LucideIcon; adminOnly?: boolean }

export const DOCK_APPS: DockApp[] = [
  { id: 'settings', label: 'Settings', icon: Settings, adminOnly: true },
]
