import { defineStore } from 'pinia'
import { apiFetch } from '@/utils/apiFetch'

export interface Payment {
  id: string
  merchantId: string
  merchantName: string
  clientName: string
  clientPhone: string
  contractId: string
  dealNumber: string
  /** tiyin */
  amount: number
  /** tiyin — amount paid so far */
  paidAmount: number
  type: 'cash' | 'card' | 'transfer'
  status: 'confirmed' | 'pending' | 'partial' | 'cancelled'
  /** ISO date string */
  date: string
  paymentProvider: string[] | null
}

interface PaymentsState {
  payments: Payment[]
  loading: boolean
  error: string | null
}

export const usePaymentsStore = defineStore('payments', {
  state: (): PaymentsState => ({
    payments: [],
    loading: false,
    error: null,
  }),

  actions: {
    async fetchPayments(merchantId?: string): Promise<void> {
      this.loading = true
      this.error = null
      try {
        const qs = merchantId ? `?merchantId=${merchantId}` : ''
        const data = await apiFetch<{ payments: Payment[] }>(`/admin/payments${qs}`)
        this.payments = data.payments
      } catch (err: any) {
        this.error = err?.message ?? 'error'
      } finally {
        this.loading = false
      }
    },
  },
})
