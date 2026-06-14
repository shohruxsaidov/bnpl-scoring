import { ref } from 'vue'
import { defineStore } from 'pinia'

import { apiFetch } from '@/utils/apiFetch'

export interface ClientListItem {
  pinfl: string
  clientName: string
  clientPhone: string
  lastScoringId: string
  lastScore: number
  lastLimit: number
  lastStatus: 'approved' | 'declined' | 'pending'
  lastScoredAt: string
  totalRuns: number
}

export interface ScoringListItem {
  id: string
  pinfl: string
  clientName: string
  clientPhone: string
  score: number
  /** Platform credit limit, tiyin */
  limit: number
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
  } | null
}

export const useScoringHistoryStore = defineStore('scoringHistory', () => {
  const clients = ref<ClientListItem[]>([])
  const records = ref<ScoringListItem[]>([])
  const detail = ref<ScoringDetail | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchClients(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const data = await apiFetch<{ clients: ClientListItem[] }>('/admin/scoring-history')
      clients.value = data.clients
    } catch (err: any) {
      error.value = err?.message ?? 'error'
    } finally {
      loading.value = false
    }
  }

  async function fetchAllList(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const data = await apiFetch<{ records: ScoringListItem[] }>('/admin/scoring-history/all')
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

  return { clients, records, detail, loading, error, fetchClients, fetchAllList, fetchDetail }
})
