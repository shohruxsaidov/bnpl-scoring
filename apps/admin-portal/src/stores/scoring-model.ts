import { ref } from 'vue'
import { defineStore } from 'pinia'

import { apiFetch as api } from '@/utils/apiFetch'

export interface ScoringModelRevision {
  id: number
  name: string
  version: string
  params: Record<string, unknown>
  createdAt: string
}

export interface CriterionResult {
  key: string
  name: string
  rawScore: number
  importantLevel: number
  weightedScore: number
  skipped: boolean
}

export type ScoringTryResult =
  | { rejected: true; stopFactor: string; name: string }
  | { rejected: false; totalScore: number; coefficient: number; breakdown: CriterionResult[] }

export interface ScoringModelHistoryItem {
  id: number
  name: string
  version: string
  createdAt: string
}

export const useScoringModelStore = defineStore('scoringModel', () => {
  const revision = ref<ScoringModelRevision | null>(null)
  const history = ref<ScoringModelHistoryItem[]>([])
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)

  async function fetch(): Promise<void> {
    loading.value = true
    error.value = null

    try {
      const body = await api<ScoringModelRevision>('/admin/scoring-model')
      revision.value = body
    } catch (e) {
      error.value = (e as Error).message
      throw e
    } finally {
      loading.value = false
    }
  }

  async function fetchHistory(): Promise<void> {
    const body = await api<{ revisions: ScoringModelHistoryItem[] }>(
      '/admin/scoring-model/history',
    )
    history.value = body.revisions
  }

  async function loadRevision(id: number): Promise<void> {
    loading.value = true

    try {
      const body = await api<ScoringModelRevision>(`/admin/scoring-model/${id}`)
      revision.value = body
    } finally {
      loading.value = false
    }
  }

  async function tryModel(id: number, inputs: Record<string, unknown>): Promise<ScoringTryResult> {
    return api<ScoringTryResult>(`/admin/scoring-model/${id}/try`, {
      method: 'POST',
      body: JSON.stringify(inputs),
    })
  }

  async function save(name: string, version: string, params: Record<string, unknown>): Promise<void> {
    saving.value = true

    try {
      const body = await api<ScoringModelRevision>('/admin/scoring-model', {
        method: 'PUT',
        body: JSON.stringify({ name, version, params }),
      })
      revision.value = body
      history.value.unshift({ id: body.id, name: body.name, version: body.version, createdAt: body.createdAt })
    } finally {
      saving.value = false
    }
  }

  return { revision, history, loading, saving, error, fetch, fetchHistory, loadRevision, tryModel, save }
})
