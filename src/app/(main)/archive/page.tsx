import { redirect } from 'next/navigation'

// Admin gating now lives in archive/layout.tsx — bare /archive isn't a
// real page any more now that the side-nav gives two real destinations.
export default function ArchivePage() {
  redirect('/archive/trpg')
}
