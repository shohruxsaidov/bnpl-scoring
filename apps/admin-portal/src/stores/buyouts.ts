import { defineStore } from 'pinia'
import { apiFetch } from '@/utils/apiFetch'

export interface BuyoutItem {
  productName: string
  price: number
  qty: number
  amount: number
}

export interface Buyout {
  id: string
  dealId: string
  dealNumber: string
  merchantId: string
  merchantName: string
  branchName: string
  agentName: string
  clientName: string
  clientPhone: string
  amount: number
  status: 'pending' | 'paid'
  createdAt: string
  items: BuyoutItem[]
}

interface State {
  buyouts: Buyout[]
  loading: boolean
  error: string | null
}

export const useBuyoutsStore = defineStore('buyouts', {
  state: (): State => ({ buyouts: [], loading: false, error: null }),

  actions: {
    async fetch(filters: { merchantId?: string; status?: string } = {}) {
      this.loading = true
      this.error = null
      try {
        const params = new URLSearchParams()
        if (filters.merchantId) params.set('merchantId', filters.merchantId)
        if (filters.status) params.set('status', filters.status)
        const qs = params.toString()
        const data = await apiFetch<{ buyouts: Buyout[] }>(`/admin/buyouts${qs ? `?${qs}` : ''}`)
        this.buyouts = data.buyouts
      } catch (err: any) {
        this.error = err?.message ?? 'error'
      } finally {
        this.loading = false
      }
    },

    async markPaid(id: string) {
      const data = await apiFetch<{ buyout: Buyout }>(`/admin/buyouts/${id}/pay`, { method: 'PATCH' })
      const idx = this.buyouts.findIndex((b) => b.id === id)
      if (idx !== -1) this.buyouts[idx] = data.buyout
      return data.buyout
    },
  },
})
