import { ref } from 'vue'
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

export const usePaymentsStore = defineStore('payments', () => {
  const payments = ref<Payment[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchPayments(merchantId?: string): Promise<void> {
    loading.value = true
    error.value = null

    try {
      const qs = merchantId ? `?merchantId=${merchantId}` : ''
      const data = await apiFetch<{ payments: Payment[] }>(`/admin/payments${qs}`)
      payments.value = data.payments
    } catch (err: any) {
      error.value = err?.message ?? 'error'
    } finally {
      loading.value = false
    }
  }

  return { payments, loading, error, fetchPayments }
})
