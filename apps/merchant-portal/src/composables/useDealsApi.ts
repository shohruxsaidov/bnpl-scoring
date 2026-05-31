import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/vue-query'
import { apiFetch } from '@/utils/apiFetch'
import { computed, type Ref } from 'vue'

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
  lang: 'ru' | 'uz'
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

export interface DealDetail extends DealListItem {
  basket: DealBasketItem[]
  branchName: string | null
  merchantInn: string | null
  pdfUrl: string | null
}

export interface CreateDealInput {
  clientId: string
  tariffId: string
  basket: Array<{ productId: string; quantity: number }>
  paymentDay: number
  signingToken: string
  scoreSum?: number | null
  scoringDecision?: string | null
  coefficient?: number | null
  /** Platform credit limit, tiyin */
  platformCreditLimit?: number | null
  criteriaScores?: Record<string, number> | null
  /** client_scorings.id recorded at scoring time, linked to this deal */
  scoringId?: string | null
  lang?: 'ru' | 'uz'
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const DEALS_KEY = ['deals'] as const
export const dealKey = (id: string) => ['deals', id] as const

export type DealSortField = 'status' | 'amount' | 'createdAt'
export type DealSortOrder = 'asc' | 'desc'

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/** Fetch the full list of deals for the current merchant/agent. */
export function useDealsQuery(sort?: Ref<{ field: DealSortField; order: DealSortOrder } | null>) {
  return useQuery({
    queryKey: computed(() => [...DEALS_KEY, sort?.value ?? null]),
    queryFn: () => {
      const s = sort?.value
      const qs = s ? `?sortBy=${s.field}&sortOrder=${s.order}` : ''
      return apiFetch<{ deals: DealListItem[] }>(`/merchant/deals${qs}`).then((r) => r.deals)
    },
    staleTime: 30_000,
    placeholderData: keepPreviousData,
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

/** Fetch a 24-hour presigned URL for the deal's Kontrakt PDF (generates on first call). */
export async function fetchContractPdfUrl(dealId: string): Promise<string> {
  const res = await apiFetch<{ url: string }>(`/merchant/deals/${dealId}/contract-pdf`)
  return res.url
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
