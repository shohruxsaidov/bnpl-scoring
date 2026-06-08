import { ref } from 'vue'
import { defineStore } from 'pinia'

import { apiFetch } from '@/utils/apiFetch'

export interface ScoringListItem {
  id: string
  merchantId: string
  merchantName: string
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
  merchantId: string
  merchantName: string
  fullName: string
  firstName: string
  lastName: string
  middleName: string
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

export const useScoringHistoryStore = defineStore('scoringHistory', () => {
  const records = ref<ScoringListItem[]>([])
  const detail = ref<ScoringDetail | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchList(merchantId?: string): Promise<void> {
    loading.value = true
    error.value = null

    try {
      const qs = merchantId ? `?merchantId=${merchantId}` : ''
      const data = await apiFetch<{ records: ScoringListItem[] }>(`/admin/scoring-history${qs}`)
      records.value = data.records
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
      const data = await apiFetch<{ scoring: ScoringDetail }>(`/admin/scoring-history/${id}`)
      detail.value = data.scoring
    } catch (err: any) {
      error.value = err?.message ?? 'error'
    } finally {
      loading.value = false
    }
  }

  return { records, detail, loading, error, fetchList, fetchDetail }
})
