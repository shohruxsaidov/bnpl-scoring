import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { apiFetch } from '@/utils/apiFetch'

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface OverdueCard {
  dealId: string
  clientName: string
  clientPhone: string
  /** tiyin */
  principal: number
  missedCount: number
  daysOverdue: number
}

export interface AgingBucket {
  key: string
  cards: OverdueCard[]
}

// ---------------------------------------------------------------------------
// Query
// ---------------------------------------------------------------------------

const BOARD_KEY = ['collection-board'] as const

export function useCollectionBoardQuery() {
  return useQuery({
    queryKey: BOARD_KEY,
    queryFn: () =>
      apiFetch<{ buckets: AgingBucket[] }>('/merchant/collection-board').then((r) => r.buckets),
    staleTime: 60_000, // 1 min
  })
}

export function useRefreshCollectionBoard() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: BOARD_KEY })
}
