/**
 * Money is stored as integers in tiyin (1/100 of a som).
 * Display helper converts to som and formats with the uz-UZ locale.
 */
const somFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

export function formatSom(tiyin: number): string {
  return somFmt.format(tiyin / 100) + " so'm"
}

export function formatSomShort(tiyin: number): string {
  return somFmt.format(tiyin / 100)
}

/** Mock async network delay wrapped in a Promise. */
export function mockDelay<T>(value: T, ms = 1500): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

export function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('uz-UZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}
