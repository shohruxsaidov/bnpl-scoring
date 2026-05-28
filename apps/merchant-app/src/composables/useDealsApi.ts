import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { apiFetch } from '@/utils/apiFetch'
import type { Ref } from 'vue'

// ---------------------------------------------------------------------------
// DTOs (mirror what the API returns)
// ---------------------------------------------------------------------------

export interface DealListItem {
  id: string
  status: string
  createdAt: string
  paymentDay: number | null
  amount: number
  totalPayable: number
  termMonths: number
  agentId: string | null
  agentName: string
  clientId: string | null
  clientName: string | null
  clientPinfl: string | null
  clientPhone: string | null
  tariffId: string | null
  tariffName: string | null
  scoreSum: number | null
  scoringDecision: string | null
}

export interface DealBasketItem {
  productId: string | null
  productName: string
  tanNarxi: string
  mxikCode: string | null
  packageCode: number | null
  packageName: string | null
  quantity: number
}

export interface DealScheduleRow {
  index: number
  dueDate: string
  amount: number
  paid: boolean
  paidAt: string | null
}

export interface DealDetail extends DealListItem {
  basket: DealBasketItem[]
  schedule: DealScheduleRow[]
}

export interface CreateDealInput {
  clientId: string
  tariffId: string
  basket: Array<{ productId: string; quantity: number }>
  paymentDay: number
  signingToken: string
  scoreSum?: number | null
  scoringDecision?: string | null
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const DEALS_KEY = ['deals'] as const
export const dealKey = (id: string) => ['deals', id] as const

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/** Fetch the full list of deals for the current merchant/agent. */
export function useDealsQuery() {
  return useQuery({
    queryKey: DEALS_KEY,
    queryFn: () => apiFetch<{ deals: DealListItem[] }>('/merchant/deals').then((r) => r.deals),
    staleTime: 30_000, // 30 s — enough freshness for a list
  })
}

/** Fetch a single deal by ID. */
export function useDealQuery(id: Ref<string>) {
  return useQuery({
    queryKey: dealKey(id.value),
    queryFn: () =>
      apiFetch<{ deal: DealDetail }>(`/merchant/deals/${id.value}`).then((r) => r.deal),
    enabled: () => !!id.value,
  })
}

/** Create a new deal (agent only). Invalidates the deals list on success. */
export function useCreateDealMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateDealInput) =>
      apiFetch<{ dealId: string }>('/merchant/deals', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: DEALS_KEY })
    },
  })
}
