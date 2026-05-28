import { defineStore } from 'pinia'
import type { ClientScoringResult, ScoreDecision } from '@/types'

export type ScoringStatus = 'idle' | 'pending' | 'completed' | 'failed' | 'timed_out'

interface ClientScoringState {
  /** SSE / scoring lifecycle status */
  status: ScoringStatus
  /** client_scorings.id returned by the backend once scoring completes */
  scoringId: string | null
  scoreSum: number | null
  /** Coefficient from the global table: 0 = denied, 0.8 = partial, 1.0 = full */
  coefficient: number | null
  decision: ScoreDecision | null
  /** Platform Credit Limit in tiyin — set on Client after scoring */
  platformCreditLimit: number | null
  /** Full per-criterion breakdown from client_scorings.criteria_scores (jsonb) */
  criteriaScores: Record<string, unknown> | null
}

export const useClientScoringStore = defineStore('clientScoring', {
  persist: {
    // Survive page refresh between Karta and Tarif steps — scoring is expensive
    pick: ['status', 'scoringId', 'scoreSum', 'coefficient', 'decision', 'platformCreditLimit', 'criteriaScores'],
  },

  state: (): ClientScoringState => ({
    status: 'idle',
    scoringId: null,
    scoreSum: null,
    coefficient: null,
    decision: null,
    platformCreditLimit: null,
    criteriaScores: null,
  }),

  getters: {
    isResolved: (s): boolean => s.status === 'completed' || s.status === 'failed' || s.status === 'timed_out',
    availableForTarif: (s): boolean => s.status === 'completed' && s.decision !== 'declined',
  },

  actions: {
    reset() {
      this.status = 'idle'
      this.scoringId = null
      this.scoreSum = null
      this.coefficient = null
      this.decision = null
      this.platformCreditLimit = null
      this.criteriaScores = null
    },

    /** Called when the Karta step completes and scoring kicks off in the background */
    setPending() {
      this.status = 'pending'
    },

    /** Called when SSE emits scoring.completed */
    setCompleted(result: ClientScoringResult) {
      this.status = 'completed'
      this.scoringId = result.scoringId
      this.scoreSum = result.scoreSum
      this.coefficient = result.coefficient
      this.decision = result.decision
      this.platformCreditLimit = result.platformCreditLimit
      this.criteriaScores = result.criteriaScores
    },

    /** Called when the backend returns a hard scoring failure */
    setFailed() {
      this.status = 'failed'
    },

    /** Called when the Tarif step waits > 30 s for scoring.completed (ADR-0010) */
    setTimedOut() {
      this.status = 'timed_out'
    },
  },
})
