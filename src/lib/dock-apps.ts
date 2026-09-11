import { Settings } from 'lucide-react'
import type { ElementType } from 'react'

// Calendar and Day Counter aren't part of this list — they live on the
// desk as their own components (calendar-desk-widget.tsx,
// day-counter-desk-widget.tsx), morphing between icon and full panel in
// place, rather than opening a separate DockAppWindow like this
// placeholder still does.
//
// icon is a plain ElementType, not lucide's own LucideIcon type — every
// call site just does <app.icon size={..} className=".." />, and a bare
// ElementType is loose enough to also accept a hand-rolled brand mark
// alongside real lucide icons, which LucideIcon's own more specific prop
// types (size: string | number, a forwardRef wrapper, etc.) otherwise
// reject. Optional — draggable-home-scene.tsx's own X-handle pseudo-app
// has none, just its own background artwork (desk-app-icon.tsx skips
// rendering app.icon entirely when it's unset).
export type DockApp = { id: string; label: string; icon?: ElementType<{ size?: number | string; className?: string }>; requiresAuth?: boolean }

// Settings itself needs no account — a guest can open it and try any
// theme same as anyone else, it just won't be saved anywhere for them
// (updateTheme in lib/actions/theme.ts no-ops without a signed-in user,
// rather than writing a guest-only row nobody would ever read back).
export const DOCK_APPS: DockApp[] = [
  { id: 'settings', label: 'Settings', icon: Settings },
]
