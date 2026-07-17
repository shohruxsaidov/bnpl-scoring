import { ref } from 'vue'
import { apiFetch } from '@/utils/apiFetch'

export type Star = 1 | 2 | 3 | 4 | 5

export interface AppRatingSummary {
  /** null when nobody has rated yet — deliberately not 0, which would read as a real score. */
  average: number | null
  count: number
  histogram: Record<Star, number>
}

const EMPTY: AppRatingSummary = {
  average: null,
  count: 0,
  histogram: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
}

export function useAppRatingsApi() {
  const summary = ref<AppRatingSummary>({ ...EMPTY })
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetch() {
    loading.value = true
    error.value = null
    try {
      summary.value = await apiFetch<AppRatingSummary>('/admin/app-ratings/summary')
    } catch (e: any) {
      error.value = e?.message ?? 'error'
      // Reset rather than keep a stale summary behind an error banner: a wrong
      // average shown as current is worse than no average.
      summary.value = { ...EMPTY }
    } finally {
      loading.value = false
    }
  }

  return { summary, loading, error, fetch }
}
