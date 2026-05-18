/**
 * Money is stored as integers in tiyin (1/100 of a som).
 * `Intl.NumberFormat('en-US')` is used deliberately — the uz-UZ locale
 * inserts narrow no-break spaces that render poorly in monospace.
 */
const somFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

export function formatSom(tiyin: number): string {
  return somFmt.format(tiyin / 100) + " so'm"
}

export function formatSomShort(tiyin: number): string {
  return somFmt.format(tiyin / 100)
}

/** Mock async network delay wrapped in a Promise. */
export function mockDelay<T>(value: T, ms = 1200): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

/** "Jul 15" — compact, monospace-friendly (no locale spaces). */
export function formatDateShort(iso: string): string {
  const d = new Date(iso)
  return `${MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')}`
}

/** "Jul 15, 2026" */
export function formatDateLong(iso: string): string {
  const d = new Date(iso)
  return `${MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')}, ${d.getFullYear()}`
}

/** Relative time such as "2 days ago" / "just now". */
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  const now = Date.now()
  const diff = Math.max(0, now - then)

  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour

  if (diff < minute) return 'just now'
  if (diff < hour) {
    const m = Math.floor(diff / minute)
    return `${m} minute${m === 1 ? '' : 's'} ago`
  }
  if (diff < day) {
    const h = Math.floor(diff / hour)
    return `${h} hour${h === 1 ? '' : 's'} ago`
  }
  const days = Math.floor(diff / day)
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`
  const months = Math.floor(days / 30)
  return `${months} month${months === 1 ? '' : 's'} ago`
}

/** Mask a PINFL keeping the first 6 and last 4 digits: 312030****0011 */
export function maskPinfl(pinfl: string): string {
  if (pinfl.length !== 14) return pinfl
  return `${pinfl.slice(0, 6)}****${pinfl.slice(-4)}`
}
