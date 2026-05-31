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

interface ScoringHistoryState {
  records: ScoringListItem[]
  detail: ScoringDetail | null
  loading: boolean
  error: string | null
}

export const useScoringHistoryStore = defineStore('scoringHistory', {
  state: (): ScoringHistoryState => ({
    records: [],
    detail: null,
    loading: false,
    error: null,
  }),

  actions: {
    async fetchList(merchantId?: string): Promise<void> {
      this.loading = true
      this.error = null
      try {
        const qs = merchantId ? `?merchantId=${merchantId}` : ''
        const data = await apiFetch<{ records: ScoringListItem[] }>(`/admin/scoring-history${qs}`)
        this.records = data.records
      } catch (err: any) {
        this.error = err?.message ?? 'error'
      } finally {
        this.loading = false
      }
    },

    async fetchDetail(id: string): Promise<void> {
      this.loading = true
      this.error = null
      this.detail = null
      try {
        const data = await apiFetch<{ scoring: ScoringDetail }>(`/admin/scoring-history/${id}`)
        this.detail = data.scoring
      } catch (err: any) {
        this.error = err?.message ?? 'error'
      } finally {
        this.loading = false
      }
    },
  },
})
