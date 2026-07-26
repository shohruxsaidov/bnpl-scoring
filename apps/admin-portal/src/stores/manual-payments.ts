import { ref } from 'vue'
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
  /** Value date, `YYYY-MM-DD`. Diverges from createdAt only when an operator backdated. */
  paymentDate: string
  createdAt: string
  adminName: string | null
}

export interface DealSearchResult {
  id: string
  dealNumber: string
  clientName: string
  clientPhone: string
  remainingAmount: number
  /** Day the deal was opened, `YYYY-MM-DD` — the earliest valid value date. */
  openedOn: string
}

export const useManualPaymentsStore = defineStore('manualPayments', () => {
  const payments = ref<ManualPayment[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetch() {
    loading.value = true
    error.value = null

    try {
      const data = await apiFetch<{ payments: ManualPayment[] }>('/admin/payments/manual')
      payments.value = data.payments
    } catch (err: any) {
      error.value = err?.message ?? 'error'
    } finally {
      loading.value = false
    }
  }

  async function searchDeals(q: string): Promise<DealSearchResult[]> {
    if (!q.trim()) return []
    const data = await apiFetch<{ deals: DealSearchResult[] }>(
      `/admin/payments/manual/deals?q=${encodeURIComponent(q)}`,
    )
    return data.deals
  }

  async function create(payload: {
    dealId: string
    amount: number
    paymentType: string
    paymentDate: string
    note?: string
  }): Promise<ManualPayment> {
    const data = await apiFetch<{ payment: ManualPayment }>('/admin/payments/manual', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    // Refetch rather than prepend: the list is ordered by value date, so a
    // backdated payment does not belong at the top and an optimistic unshift
    // would put it somewhere the server never would.
    await fetch()
    return data.payment
  }

  return { payments, loading, error, fetch, searchDeals, create }
})
