import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { apiFetch } from '@/utils/apiFetch'
import type { Ref } from 'vue'

// ---------------------------------------------------------------------------
// DTOs (mirror what the API returns)
// ---------------------------------------------------------------------------

export interface ScoringListItem {
  id: string
  clientName: string
  clientPhone: string
  score: number
  /** Platform credit limit, tiyin */
  limit: number
  region: string | null
  address: string | null
  scoredAt: string
  status: 'approved' | 'declined' | 'pending'
}

export interface ScoringFactor {
  label: string
  score: number
}

export interface ScoringDetail {
  id: string
  fullName: string
  firstName: string
  lastName: string
  patronymic: string
  phone: string
  score: number
  /** Platform credit limit, tiyin */
  limit: number
  status: 'review' | 'approved' | 'declined'
  scoredAt: string
  pinfl: string
  birthDate: string
  gender: string
  region: string | null
  address: string | null
  passport: string
  citizenship: string
  coefficient: number | null
  factors: ScoringFactor[]
  platformStats: {
    total: number
    active: number
    closed: number
    overdue: number
    /** Total paid across the client's deals, tiyin */
    totalPaid: number
  }
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const SCORING_HISTORY_KEY = ['scoring-history'] as const
export const scoringKey = (id: string) => ['scoring-history', id] as const

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/** Fetch the full list of scoring runs for the current merchant. */
export function useScoringHistoryQuery() {
  return useQuery({
    queryKey: SCORING_HISTORY_KEY,
    queryFn: () =>
      apiFetch<{ records: ScoringListItem[] }>('/merchant/scoring-history').then((r) => r.records),
    staleTime: 30_000,
  })
}

export interface SaveScoringInput {
  clientId: string
  scoreSum?: number | null
  coefficient?: number | null
  decision: string
  /** Platform credit limit, tiyin */
  platformCreditLimit: number
  criteriaScores?: Record<string, number> | null
}

/** Record a scoring run the moment scoring completes (before any deal exists). */
export function useSaveScoringMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SaveScoringInput) =>
      apiFetch<{ id: string }>('/merchant/scoring-history', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SCORING_HISTORY_KEY })
    },
  })
}

/** Fetch a single scoring run by ID. */
export function useScoringQuery(id: Ref<string>) {
  return useQuery({
    queryKey: scoringKey(id.value),
    queryFn: () =>
      apiFetch<{ scoring: ScoringDetail }>(`/merchant/scoring-history/${id.value}`).then(
        (r) => r.scoring,
      ),
    enabled: () => !!id.value,
  })
}
