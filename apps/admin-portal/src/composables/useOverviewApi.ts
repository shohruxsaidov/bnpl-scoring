import { ref } from 'vue'
import { apiFetch } from '@/utils/apiFetch'

export interface OverviewMerchant {
  id: string
  name: string
  active: boolean
  dealCount: number
  overdueCount: number
}

export function useOverviewApi() {
  const merchantHealth = ref<OverviewMerchant[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetch() {
    loading.value = true
    error.value = null
    try {
      const data = await apiFetch<{ merchantHealth: OverviewMerchant[] }>('/admin/overview')
      merchantHealth.value = data.merchantHealth
    } catch (e: any) {
      error.value = e?.message ?? 'error'
    } finally {
      loading.value = false
    }
  }

  return { merchantHealth, loading, error, fetch }
}
