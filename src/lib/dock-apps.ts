import { Settings, Hourglass, type LucideIcon } from 'lucide-react'

// Calendar isn't part of this list — it lives on the desk as its own
// component (calendar-desk-widget.tsx), morphing between icon and full
// panel in place, rather than opening a separate DockAppWindow like
// these two placeholders still do.
export type DockApp = { id: string; label: string; icon: LucideIcon }

export const DOCK_APPS: DockApp[] = [
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'daycounter', label: 'Day Counter', icon: Hourglass },
]
