import { ref } from 'vue'
import { defineStore } from 'pinia'

import { apiFetch } from '@/utils/apiFetch'

export interface ScoringListItem {
  id: number
  userId: number | null
  fullName: string | null
  phone: string | null
  status: string
  score: number | null
  creditLimit: string | null
  currentPipeline: string | null
  createdAt: string
}

export interface ScoringFilters {
  limit: number
  offset: number
}

export interface ScoringDetailPipeline {
  id: number
  type: string
  status: string
  rejectReasonCode: string | null
  summary: Record<string, unknown> | null
  raw: Record<string, unknown> | null
  createdAt: string
}

export interface ScoringDetail {
  id: number
  userId: number | null
  fullName: string | null
  phone: string | null
  status: string
  score: number | null
  creditLimit: string | null
  currentPipeline: string | null
  katmClaimId: string | null
  rejectReasonCode: string | null
  createdAt: string
  updatedAt: string
  pipelines: ScoringDetailPipeline[]
}

export const useScoringsStore = defineStore('scorings', () => {
  const list = ref<ScoringListItem[]>([])
  const total = ref(0)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const detail = ref<ScoringDetail | null>(null)
  const detailLoading = ref(false)
  const detailError = ref<string | null>(null)

  async function fetchList(filters: ScoringFilters): Promise<void> {
    loading.value = true
    error.value = null

    try {
      const qs = new URLSearchParams()
      qs.set('limit', String(filters.limit))
      qs.set('offset', String(filters.offset))

      const data = await apiFetch<{ scorings: ScoringListItem[]; total: number }>(
        `/admin/scorings?${qs}`,
      )
      list.value = data.scorings
      total.value = data.total
    } catch (err: any) {
      error.value = err?.message ?? 'error'
    } finally {
      loading.value = false
    }
  }

  async function fetchDetail(id: number | string): Promise<void> {
    detailLoading.value = true
    detailError.value = null
    detail.value = null

    try {
      const data = await apiFetch<{ scoring: ScoringDetail }>(`/admin/scorings/${id}`)
      detail.value = data.scoring
    } catch (err: any) {
      detailError.value = err?.message ?? 'error'
    } finally {
      detailLoading.value = false
    }
  }

  return {
    list,
    total,
    loading,
    error,
    fetchList,
    detail,
    detailLoading,
    detailError,
    fetchDetail,
  }
})
