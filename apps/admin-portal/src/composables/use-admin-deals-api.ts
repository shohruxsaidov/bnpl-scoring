import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed } from 'vue'
import { apiFetch } from '@/utils/apiFetch'
import type { Ref } from 'vue'

// ---------------------------------------------------------------------------
// DTOs — mirror what /admin/deals/:id returns
// ---------------------------------------------------------------------------

export interface AdminDealBasketItem {
  productName: string
  price: string   // decimal string e.g. "15000.00"
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
  dealNumber: string
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
  prepaymentAmount: number | null
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

export interface DealComment {
  id: string
  text: string
  createdAt: string
  authorName: string
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const adminDealKey = (id: string) => ['admin', 'deals', id] as const
export const adminDealCommentsKey = (id: string) => ['admin', 'deals', id, 'comments'] as const

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useAdminDealQuery(id: Ref<string>) {
  return useQuery({
    queryKey: computed(() => adminDealKey(id.value)),
    queryFn: () =>
      apiFetch<{ deal: AdminDealDetail }>(`/admin/deals/${id.value}`).then((r) => r.deal),
    enabled: () => !!id.value,
  })
}

export function useDealCommentsQuery(id: Ref<string>) {
  return useQuery({
    queryKey: computed(() => adminDealCommentsKey(id.value)),
    queryFn: () =>
      apiFetch<{ comments: DealComment[] }>(`/admin/deals/${id.value}/comments`).then(
        (r) => r.comments,
      ),
    enabled: () => !!id.value,
  })
}

export function useAddDealComment(dealId: Ref<string>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (text: string) =>
      apiFetch<{ comment: DealComment }>(`/admin/deals/${dealId.value}/comments`, {
        method: 'POST',
        body: JSON.stringify({ text }),
      }).then((r) => r.comment),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminDealCommentsKey(dealId.value) })
    },
  })
}
