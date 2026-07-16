import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { apiFetch } from '@/utils/apiFetch'

export interface OverdueCard {
  dealId: string
  dealNumber: string
  merchantId: string
  merchantName: string
  clientName: string
  clientPhone: string
  /** som */
  principal: number
  missedCount: number
  daysOverdue: number
}

export interface AgingBucket {
  key: string
  cards: OverdueCard[]
}

export const useCollectionBoardStore = defineStore('collectionBoard', () => {
  const buckets = ref<AgingBucket[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const totalCards = computed(() => buckets.value.reduce((n, b) => n + b.cards.length, 0))

  async function fetchBoard(merchantId?: string): Promise<void> {
    loading.value = true
    error.value = null

    try {
      const qs = merchantId ? `?merchantId=${merchantId}` : ''
      const data = await apiFetch<{ buckets: AgingBucket[] }>(`/admin/collection-board${qs}`)
      buckets.value = data.buckets
    } catch (err: any) {
      error.value = err?.message ?? 'error'
    } finally {
      loading.value = false
    }
  }

  return { buckets, loading, error, totalCards, fetchBoard }
})
