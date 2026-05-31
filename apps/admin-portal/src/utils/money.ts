/**
 * Money is stored as integers in tiyin (1/100 of a som).
 * Display helpers convert to som. We deliberately use the en-US locale
 * (comma grouping) — the uz-UZ locale renders narrow-space separators
 * that look broken inside the JetBrains Mono number style.
 */
const somFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

export function formatSom(tiyin: number): string {
  return somFmt.format(tiyin / 100) + " so'm"
}

export function formatSomShort(tiyin: number): string {
  return somFmt.format(tiyin / 100)
}

/** Compact volume, e.g. 8.42B so'm — used in dense stat cards. */
export function formatSomCompact(tiyin: number): string {
  const som = tiyin / 100
  if (som >= 1_000_000_000) return (som / 1_000_000_000).toFixed(2) + 'B'
  if (som >= 1_000_000) return (som / 1_000_000).toFixed(1) + 'M'
  if (som >= 1_000) return (som / 1_000).toFixed(0) + 'K'
  return somFmt.format(som)
}

/** Mock async network delay wrapped in a Promise. */
export function mockDelay<T>(value: T, ms = 1200): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

export function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return (
    d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  )
}

/** Mask a 14-digit PINFL keeping first 4 and last 2: 3120********11 */
export function maskPinfl(pinfl: string): string {
  if (pinfl.length < 6) return pinfl
  return pinfl.slice(0, 4) + '*'.repeat(pinfl.length - 6) + pinfl.slice(-2)
}
