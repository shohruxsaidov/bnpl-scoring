import { ref } from 'vue'
import { defineStore } from 'pinia'
import { apiFetch } from '@/utils/apiFetch'

export interface ScoringSessionListItem {
  id: string
  clientName: string
  clientPhone: string
  clientPinfl: string
  status: string
  consentDate: string
  createdAt: string
  scoredAt: string | null
}

export interface ScoringPipelineItem {
  id: string
  type: string
  status: string
  result: unknown
  error: string | null
  startedAt: string | null
  completedAt: string | null
}

export interface ScoringSessionDetail {
  id: string
  clientName: string
  clientPhone: string
  clientPinfl: string
  status: string
  consentId: string
  consentDate: string
  katmClaimId: string | null
  createdAt: string
  scoredAt: string | null
  pipelines: ScoringPipelineItem[]
  userLimit: {
    limitAmount: number
    scoredAt: string
    updatedAt: string
  } | null
}

export const useScoringSessionsStore = defineStore('scoringSessions', () => {
  const sessions = ref<ScoringSessionListItem[]>([])
  const detail = ref<ScoringSessionDetail | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchList(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const data = await apiFetch<{ sessions: ScoringSessionListItem[] }>('/admin/scoring-sessions')
      sessions.value = data.sessions
    } catch (err: any) {
      error.value = err?.message ?? 'error'
    } finally {
      loading.value = false
    }
  }

  async function fetchDetail(id: string): Promise<void> {
    loading.value = true
    error.value = null
    detail.value = null
    try {
      const data = await apiFetch<{ session: ScoringSessionDetail }>(`/admin/scoring-sessions/${id}`)
      detail.value = data.session
    } catch (err: any) {
      error.value = err?.message ?? 'error'
    } finally {
      loading.value = false
    }
  }

  return { sessions, detail, loading, error, fetchList, fetchDetail }
})
