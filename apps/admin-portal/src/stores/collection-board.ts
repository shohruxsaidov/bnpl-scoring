import { defineStore } from 'pinia'
import { apiFetch } from '@/utils/apiFetch'

export interface OverdueCard {
  dealId: string
  dealNumber: string
  merchantId: string
  merchantName: string
  clientName: string
  clientPhone: string
  /** tiyin */
  principal: number
  missedCount: number
  daysOverdue: number
}

export interface AgingBucket {
  key: string
  cards: OverdueCard[]
}

interface CollectionBoardState {
  buckets: AgingBucket[]
  loading: boolean
  error: string | null
}

export const useCollectionBoardStore = defineStore('collectionBoard', {
  state: (): CollectionBoardState => ({
    buckets: [],
    loading: false,
    error: null,
  }),

  getters: {
    totalCards: (s): number => s.buckets.reduce((n, b) => n + b.cards.length, 0),
  },

  actions: {
    async fetchBoard(merchantId?: string): Promise<void> {
      this.loading = true
      this.error = null
      try {
        const qs = merchantId ? `?merchantId=${merchantId}` : ''
        const data = await apiFetch<{ buckets: AgingBucket[] }>(`/admin/collection-board${qs}`)
        this.buckets = data.buckets
      } catch (err: any) {
        this.error = err?.message ?? 'error'
      } finally {
        this.loading = false
      }
    },
  },
})
