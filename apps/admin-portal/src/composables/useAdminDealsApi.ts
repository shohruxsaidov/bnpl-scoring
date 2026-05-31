import { useQuery } from '@tanstack/vue-query'
import { apiFetch } from '@/utils/apiFetch'
import type { Ref } from 'vue'

// ---------------------------------------------------------------------------
// DTOs — mirror what /admin/deals/:id returns
// ---------------------------------------------------------------------------

export interface AdminDealBasketItem {
  productName: string
  tanNarxi: string   // decimal string e.g. "15000.00"
  mxikCode: string | null
  quantity: number
}

export interface AdminDealScheduleRow {
  index: number
  dueDate: string
  amount: number
  paid: boolean
  paidAt: string | null
}

export interface AdminDealFactor {
  label: string
  weight: number
  value: string
}

export interface AdminDealDetail {
  id: string
  merchantId: string
  merchantName: string
  clientName: string
  clientPinfl: string
  clientPhone: string
  status: string
  amount: number
  totalPayable: number
  termMonths: number
  paymentDay: number | null
  scoreSum: number | null
  scoringDecision: string | null
  agentId: string
  agentName: string
  tariffName: string
  createdAt: string
  lang: string
  basket: AdminDealBasketItem[]
  schedule: AdminDealScheduleRow[]
  factors: AdminDealFactor[]
}

// ---------------------------------------------------------------------------
// Query key
// ---------------------------------------------------------------------------

export const adminDealKey = (id: string) => ['admin', 'deals', id] as const

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAdminDealQuery(id: Ref<string>) {
  return useQuery({
    queryKey: adminDealKey(id.value),
    queryFn: () =>
      apiFetch<{ deal: AdminDealDetail }>(`/admin/deals/${id.value}`).then((r) => r.deal),
    enabled: () => !!id.value,
  })
}
