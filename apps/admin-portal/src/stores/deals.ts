import { defineStore } from 'pinia'
import { apiFetch } from '@/utils/apiFetch'
import type { Deal } from '@/types'

interface DealsState {
  deals: Deal[]
  loading: boolean
  error: string | null
}

export const useDealsStore = defineStore('deals', {
  state: (): DealsState => ({
    deals: [],
    loading: false,
    error: null,
  }),

  getters: {
    total: (s): number => s.deals.length,
    overdueCount: (s): number => s.deals.filter((d) => d.status === 'overdue').length,
    platformVolume: (s): number =>
      s.deals
        .filter((d) => ['active', 'overdue', 'closed'].includes(d.status))
        .reduce((sum, d) => sum + d.amount, 0),
    recent:
      (s) =>
      (limit: number): Deal[] =>
        [...s.deals]
          .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
          .slice(0, limit),
    forTenant:
      (s) =>
      (tenantId: string): Deal[] =>
        s.deals.filter((d) => d.tenantId === tenantId),
    byId:
      (s) =>
      (id: string): Deal | undefined =>
        s.deals.find((d) => d.id === id),
  },

  actions: {
    async fetchDeals(): Promise<void> {
      this.loading = true
      this.error = null
      try {
        const data = await apiFetch<{ deals: Deal[] }>('/admin/deals')
        this.deals = data.deals
      } catch (err: any) {
        this.error = err?.message ?? 'error'
      } finally {
        this.loading = false
      }
    },
  },
})
