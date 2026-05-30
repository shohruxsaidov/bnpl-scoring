import { defineStore } from 'pinia'
import type { Deal } from '@/types'

const API = import.meta.env.VITE_API_URL ?? '/api/v1'

export const useDealsStore = defineStore('deals', {
  state: () => ({
    deals: [] as Deal[],
    loading: false,
    error: '',
  }),

  getters: {
    activeDeals: (s): Deal[] =>
      s.deals.filter((d) => d.status === 'active' || d.status === 'overdue'),
    closedDeals: (s): Deal[] => s.deals.filter((d) => d.status === 'closed'),
    overdueDeals: (s): Deal[] => s.deals.filter((d) => d.status === 'overdue'),
    hasOverdue(): boolean {
      return this.overdueDeals.length > 0
    },
    totalPaid: (s): number =>
      s.deals.reduce(
        (sum, d) => sum + d.schedule.filter((e) => e.paid).reduce((ps, e) => ps + e.amount, 0),
        0,
      ),
    nextPaymentDate: (s): string | null => {
      const upcoming = s.deals
        .filter((d) => d.nextPaymentDate !== null)
        .map((d) => d.nextPaymentDate as string)
        .sort()
      return upcoming[0] ?? null
    },
  },

  actions: {
    byId(id: string): Deal | undefined {
      return this.deals.find((d) => d.id === id)
    },

    async fetchAll(): Promise<void> {
      this.loading = true
      this.error = ''
      try {
        const res = await fetch(`${API}/client/deals`, { credentials: 'include' })
        if (!res.ok) throw new Error('fetch_failed')
        const data: { deals: Deal[] } = await res.json()
        this.deals = data.deals
      } catch {
        this.error = 'load_failed'
      } finally {
        this.loading = false
      }
    },

    async fetchById(id: string): Promise<Deal | null> {
      try {
        const res = await fetch(`${API}/client/deals/${id}`, { credentials: 'include' })
        if (!res.ok) return null
        const data: { deal: Deal } = await res.json()
        const idx = this.deals.findIndex((d) => d.id === id)
        if (idx >= 0) this.deals[idx] = data.deal
        else this.deals.push(data.deal)
        return data.deal
      } catch {
        return null
      }
    },
  },
})
