import { computed, type Ref } from 'vue'
import { keepPreviousData, useQuery } from '@tanstack/vue-query'
import { apiFetch } from '@/utils/apiFetch'

// ---------------------------------------------------------------------------
// The Wizard-run board. Sessions are the runs that DIDN'T become deals as much
// as the ones that did — rejections, abandoned carts, expiries — so this list
// is scoped and flattened server-side and shows every terminal status, not just
// the live ones.
// ---------------------------------------------------------------------------

export const SESSION_STATUSES = [
  'active',
  'completed',
  'rejected',
  'abandoned',
  'expired',
] as const

export type DealSessionStatus = (typeof SESSION_STATUSES)[number]

export interface DealSessionListItem {
  id: string
  status: DealSessionStatus
  currentStep: string
  /** 1-based position in this run's sequence — `full` and `reuse` differ in shape. */
  stepIndex: number
  stepCount: number
  flowMode: 'full' | 'reuse'
  clientName: string | null
  clientPhone: string | null
  agentId: string
  agentName: string | null
  branchName: string | null
  /** Basket total in som, null before the products step. */
  amount: number | null
  /** Stop-factor code — only ever set on a `rejected` run. */
  rejectReason: string | null
  /** Set on `completed` runs: the deal this session became. */
  dealId: string | null
  createdAt: string
  updatedAt: string
}

export interface DealSessionListResult {
  sessions: DealSessionListItem[]
  /** The server hit its cap — the list is a recent slice, not the whole history. */
  truncated: boolean
}

export const DEAL_SESSIONS_KEY = ['deal-sessions'] as const

/**
 * The board's list. Polls only while it's the visible tab AND the filter is
 * `active` — a live board goes stale within a minute (the expiry sweep runs
 * every 5 min behind the user's back), while history never moves.
 */
export function useDealSessionsQuery(
  status: Ref<DealSessionStatus | null>,
  enabled: Ref<boolean>,
) {
  return useQuery({
    queryKey: computed(() => [...DEAL_SESSIONS_KEY, status.value]),
    queryFn: () => {
      const qs = status.value ? `?status=${status.value}` : ''
      return apiFetch<DealSessionListResult>(`/merchant/deal-sessions${qs}`)
    },
    enabled,
    staleTime: 15_000,
    placeholderData: keepPreviousData,
    refetchInterval: () => (enabled.value && status.value === 'active' ? 30_000 : false),
    refetchOnWindowFocus: () => enabled.value && status.value === 'active',
  })
}
