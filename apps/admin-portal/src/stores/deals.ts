import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { apiFetch } from '@/utils/apiFetch'
import type { Deal } from '@/types'

export const useDealsStore = defineStore('deals', () => {
  const deals = ref<Deal[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const total = computed(() => deals.value.length)
  const overdueCount = computed(() => deals.value.filter((d) => d.status === 'overdue').length)
  const platformVolume = computed(() =>
    deals.value
      .filter((d) => ['active', 'overdue', 'closed'].includes(d.status))
      .reduce((sum, d) => sum + d.amount, 0),
  )

  function recent(limit: number): Deal[] {
    return [...deals.value]
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .slice(0, limit)
  }

  function forTenant(tenantId: string): Deal[] {
    return deals.value.filter((d) => d.tenantId === tenantId)
  }

  function byId(id: string): Deal | undefined {
    return deals.value.find((d) => d.id === id)
  }

  async function fetchDeals(): Promise<void> {
    loading.value = true
    error.value = null

    try {
      const data = await apiFetch<{ deals: Deal[] }>('/admin/deals')
      deals.value = data.deals
    } catch (err: any) {
      error.value = err?.message ?? 'error'
    } finally {
      loading.value = false
    }
  }

  return {
    deals,
    loading,
    error,
    total,
    overdueCount,
    platformVolume,
    recent,
    forTenant,
    byId,
    fetchDeals,
  }
})
