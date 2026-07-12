import { ref } from 'vue'
import { apiFetch } from '@/utils/apiFetch'

export interface OverviewMerchant {
  id: string
  name: string
  active: boolean
  dealCount: number
  overdueCount: number
}

export interface KybStats {
  pending: number
  verified: number
  rejected: number
}

export function useOverviewApi() {
  const merchantHealth = ref<OverviewMerchant[]>([])
  const kybStats = ref<KybStats>({ pending: 0, verified: 0, rejected: 0 })
  // Deals past the end of their schedule that are still open. Each one is a
  // client who cannot buy from anyone until an admin closes it.
  const stuckDeals = ref(0)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetch() {
    loading.value = true
    error.value = null
    try {
      const data = await apiFetch<{
        merchantHealth: OverviewMerchant[]
        kybStats: KybStats
        stuckDeals: number
      }>('/admin/overview')
      merchantHealth.value = data.merchantHealth
      kybStats.value = data.kybStats
      stuckDeals.value = data.stuckDeals
    } catch (e: any) {
      error.value = e?.message ?? 'error'
    } finally {
      loading.value = false
    }
  }

  return { merchantHealth, kybStats, stuckDeals, loading, error, fetch }
}
