import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { apiFetch as api } from '@/utils/apiFetch'

import type {
  Client,
  ClientOverview,
  ClientDeal,
  ClientScoringEntry,
  ClientPaymentRow,
} from '@/types'

export const useClientsStore = defineStore('clients', () => {
  const clients = ref<Client[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const detail = ref<ClientOverview | null>(null)
  const detailDeals = ref<ClientDeal[]>([])
  const detailScoring = ref<ClientScoringEntry[]>([])
  const detailPayments = ref<ClientPaymentRow[]>([])

  const detailLoading = ref(false)

  const dealsLoaded = ref(false)
  const scoringLoaded = ref(false)
  const paymentsLoaded = ref(false)

  const hasDetail = computed(() => detail.value !== null)

  async function fetchAll(): Promise<void> {
    loading.value = true
    error.value = null

    try {
      const body = await api<{ clients: Client[] }>('/admin/clients')
      clients.value = body.clients
    } catch (e) {
      error.value = (e as Error).message
      throw e
    } finally {
      loading.value = false
    }
  }

  async function fetchDetail(id: string): Promise<void> {
    detail.value = null
    detailDeals.value = []
    detailScoring.value = []
    detailPayments.value = []

    dealsLoaded.value = false
    scoringLoaded.value = false
    paymentsLoaded.value = false

    detailLoading.value = true

    try {
      detail.value = await api<ClientOverview>(`/admin/clients/${id}`)
    } finally {
      detailLoading.value = false
    }
  }

  async function fetchDetailDeals(id: string): Promise<void> {
    if (dealsLoaded.value) return

    const body = await api<{ deals: ClientDeal[] }>(
      `/admin/clients/${id}/deals`,
    )

    detailDeals.value = body.deals
    dealsLoaded.value = true
  }

  async function fetchDetailScoring(id: string): Promise<void> {
    if (scoringLoaded.value) return

    const body = await api<{ history: ClientScoringEntry[] }>(
      `/admin/clients/${id}/scoring`,
    )

    detailScoring.value = body.history
    scoringLoaded.value = true
  }

  async function fetchDetailPayments(id: string): Promise<void> {
    if (paymentsLoaded.value) return

    const body = await api<{ payments: ClientPaymentRow[] }>(
      `/admin/clients/${id}/payments`,
    )

    detailPayments.value = body.payments
    paymentsLoaded.value = true
  }

  return {
    clients,
    loading,
    error,

    detail,
    detailDeals,
    detailScoring,
    detailPayments,

    detailLoading,

    dealsLoaded,
    scoringLoaded,
    paymentsLoaded,

    hasDetail,

    fetchAll,
    fetchDetail,
    fetchDetailDeals,
    fetchDetailScoring,
    fetchDetailPayments,
  }
})
