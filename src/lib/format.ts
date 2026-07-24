export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffSec = Math.round(diffMs / 1000)

  const units: [number, string][] = [
    [60, 'second'],
    [60, 'minute'],
    [24, 'hour'],
    [7, 'day'],
    [4.345, 'week'],
    [12, 'month'],
    [Infinity, 'year'],
  ]

  let value = diffSec
  for (const [amount, unit] of units) {
    if (Math.abs(value) < amount) {
      const rounded = Math.round(value)
      if (unit === 'second' && rounded < 10) return 'just now'
      return `${rounded} ${unit}${Math.abs(rounded) === 1 ? '' : 's'} ago`
    }
    value /= amount
  }
  return new Date(iso).toLocaleDateString()
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}
