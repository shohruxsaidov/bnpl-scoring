import { useMutation } from '@tanstack/vue-query'
import { apiFetch } from '@/utils/apiFetch'

// ---------------------------------------------------------------------------
// Recording a scoring run. The list/detail views live in the platform-admin
// app — the merchant app only records scorings during the deal wizard.
// ---------------------------------------------------------------------------

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
  return useMutation({
    mutationFn: (input: SaveScoringInput) =>
      apiFetch<{ id: string }>('/merchant/scoring-history', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  })
}
