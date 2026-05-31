import { defineStore } from 'pinia'
import { apiFetch } from '@/utils/apiFetch'

export interface ManualPayment {
  id: string
  dealId: string
  dealNumber: string
  clientName: string
  clientPhone: string
  amount: number
  paymentType: string
  note: string | null
  createdAt: string
  adminName: string | null
}

export interface DealSearchResult {
  id: string
  dealNumber: string
  clientName: string
  clientPhone: string
  remainingAmount: number
}

interface State {
  payments: ManualPayment[]
  loading: boolean
  error: string | null
}

export const useManualPaymentsStore = defineStore('manualPayments', {
  state: (): State => ({ payments: [], loading: false, error: null }),

  actions: {
    async fetch() {
      this.loading = true
      this.error = null
      try {
        const data = await apiFetch<{ payments: ManualPayment[] }>('/admin/payments/manual')
        this.payments = data.payments
      } catch (err: any) {
        this.error = err?.message ?? 'error'
      } finally {
        this.loading = false
      }
    },

    async searchDeals(q: string): Promise<DealSearchResult[]> {
      if (!q.trim()) return []
      const data = await apiFetch<{ deals: DealSearchResult[] }>(
        `/admin/payments/manual/deals?q=${encodeURIComponent(q)}`,
      )
      return data.deals
    },

    async create(payload: {
      dealId: string
      amount: number
      paymentType: string
      note?: string
    }): Promise<ManualPayment> {
      const data = await apiFetch<{ payment: ManualPayment }>('/admin/payments/manual', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      this.payments.unshift(data.payment)
      return data.payment
    },
  },
})
