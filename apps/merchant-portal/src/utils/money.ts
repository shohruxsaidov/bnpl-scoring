/**
 * Money is stored as som (the API returns every amount in whole som).
 * Display helper formats the som value with the uz-UZ locale.
 */
const somFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export function formatSom(som: number): string {
  return somFmt.format(som) + " so'm";
}

export function formatSomShort(som: number): string {
  return somFmt.format(som);
}

/** Mock async network delay wrapped in a Promise. */
export function mockDelay<T>(value: T, ms = 1500): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('uz-UZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
