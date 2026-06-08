import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import type { ClientScoringResult, ScoreDecision } from '@/types'

export type ScoringStatus = 'idle' | 'pending' | 'completed' | 'failed' | 'timed_out'

export const useClientScoringStore = defineStore(
  'clientScoring',
  () => {
    const status = ref<ScoringStatus>('idle')
    const scoringId = ref<string | null>(null)
    const scoreSum = ref<number | null>(null)
    const coefficient = ref<number | null>(null)
    const decision = ref<ScoreDecision | null>(null)
    const platformCreditLimit = ref<number | null>(null)
    const criteriaScores = ref<Record<string, unknown> | null>(null)

    const isResolved = computed(() =>
      status.value === 'completed' || status.value === 'failed' || status.value === 'timed_out',
    )
    const availableForTarif = computed(
      () => status.value === 'completed' && decision.value !== 'declined',
    )

    function reset() {
      status.value = 'idle'
      scoringId.value = null
      scoreSum.value = null
      coefficient.value = null
      decision.value = null
      platformCreditLimit.value = null
      criteriaScores.value = null
    }

    function setPending() {
      status.value = 'pending'
    }

    function setCompleted(result: ClientScoringResult) {
      status.value = 'completed'
      scoringId.value = result.scoringId
      scoreSum.value = result.scoreSum
      coefficient.value = result.coefficient
      decision.value = result.decision
      platformCreditLimit.value = result.platformCreditLimit
      criteriaScores.value = result.criteriaScores
    }

    function setFailed() {
      status.value = 'failed'
    }

    function setTimedOut() {
      status.value = 'timed_out'
    }

    return {
      status,
      scoringId,
      scoreSum,
      coefficient,
      decision,
      platformCreditLimit,
      criteriaScores,
      isResolved,
      availableForTarif,
      reset,
      setPending,
      setCompleted,
      setFailed,
      setTimedOut,
    }
  },
  {
    persist: {
      pick: ['status', 'scoringId', 'scoreSum', 'coefficient', 'decision', 'platformCreditLimit', 'criteriaScores'],
    },
  },
)
