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

export interface ScoringTryResult {
  totalScore: number
  coefficient: number
  breakdown: CriterionResult[]
}

export interface ScoringModelHistoryItem {
  id: number
  name: string
  version: string
  createdAt: string
}

interface ScoringModelState {
  revision: ScoringModelRevision | null
  history: ScoringModelHistoryItem[]
  loading: boolean
  saving: boolean
  error: string | null
}

export const useScoringModelStore = defineStore('scoringModel', {
  state: (): ScoringModelState => ({
    revision: null,
    history: [],
    loading: false,
    saving: false,
    error: null,
  }),

  actions: {
    async fetch(): Promise<void> {
      this.loading = true
      this.error = null
      try {
        const body = await api<ScoringModelRevision>('/admin/scoring-model')
        this.revision = body
      } catch (e) {
        this.error = (e as Error).message
        throw e
      } finally {
        this.loading = false
      }
    },

    async fetchHistory(): Promise<void> {
      const body = await api<{ revisions: ScoringModelHistoryItem[] }>(
        '/admin/scoring-model/history',
      )
      this.history = body.revisions
    },

    async loadRevision(id: number): Promise<void> {
      this.loading = true
      try {
        const body = await api<ScoringModelRevision>(`/admin/scoring-model/${id}`)
        this.revision = body
      } finally {
        this.loading = false
      }
    },

    async tryModel(id: number, inputs: Record<string, unknown>): Promise<ScoringTryResult> {
      return api<ScoringTryResult>(`/admin/scoring-model/${id}/try`, {
        method: 'POST',
        body: JSON.stringify(inputs),
      })
    },

    async save(name: string, version: string, params: Record<string, unknown>): Promise<void> {
      this.saving = true
      try {
        const body = await api<ScoringModelRevision>('/admin/scoring-model', {
          method: 'PUT',
          body: JSON.stringify({ name, version, params }),
        })
        this.revision = body
        // Prepend to local history so the list is immediately up to date
        this.history.unshift({ id: body.id, name: body.name, version: body.version, createdAt: body.createdAt })
      } finally {
        this.saving = false
      }
    },
  },
})
