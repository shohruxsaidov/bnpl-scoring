import { ref } from 'vue'
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
  documentUrl: string | null
  paidAt: string | null
  paidByName: string | null
  items: BuyoutItem[]
}

export const useBuyoutsStore = defineStore('buyouts', () => {
  const buyouts = ref<Buyout[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetch(filters: { merchantId?: string; status?: string } = {}) {
    loading.value = true
    error.value = null

    try {
      const params = new URLSearchParams()
      if (filters.merchantId) params.set('merchantId', filters.merchantId)
      if (filters.status) params.set('status', filters.status)
      const qs = params.toString()
      const data = await apiFetch<{ buyouts: Buyout[] }>(`/admin/buyouts${qs ? `?${qs}` : ''}`)
      buyouts.value = data.buyouts
    } catch (err: any) {
      error.value = err?.message ?? 'error'
    } finally {
      loading.value = false
    }
  }

  // The proof of payment is required and rides the same request: apiFetch sends
  // FormData as multipart and lets the browser set the boundary.
  async function markPaid(id: string, document: File) {
    const form = new FormData()
    form.append('file', document)
    const data = await apiFetch<{ buyout: Buyout }>(`/admin/buyouts/${id}/pay`, {
      method: 'PATCH',
      body: form,
    })
    const idx = buyouts.value.findIndex((b) => b.id === id)
    if (idx !== -1) buyouts.value[idx] = data.buyout
    return data.buyout
  }

  return { buyouts, loading, error, fetch, markPaid }
})
