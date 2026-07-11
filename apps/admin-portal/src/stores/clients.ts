import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { apiFetch as api } from '@/utils/apiFetch'

import type {
  Client,
  ClientOverview,
  ClientDeal,
  ClientScoringEntry,
  ClientPaymentRow,
  ClientNotificationRow,
  SendPushInput,
} from '@/types'

export const useClientsStore = defineStore('clients', () => {
  const clients = ref<Client[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const detail = ref<ClientOverview | null>(null)
  const detailDeals = ref<ClientDeal[]>([])
  const detailScoring = ref<ClientScoringEntry[]>([])
  const detailPayments = ref<ClientPaymentRow[]>([])
  const detailNotifications = ref<ClientNotificationRow[]>([])

  const detailLoading = ref(false)

  const dealsLoaded = ref(false)
  const scoringLoaded = ref(false)
  const paymentsLoaded = ref(false)
  const notificationsLoaded = ref(false)

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
    detailNotifications.value = []

    dealsLoaded.value = false
    scoringLoaded.value = false
    paymentsLoaded.value = false
    notificationsLoaded.value = false

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

  async function fetchDetailNotifications(id: string, force = false): Promise<void> {
    if (notificationsLoaded.value && !force) return

    const body = await api<{ notifications: ClientNotificationRow[] }>(
      `/admin/clients/${id}/notifications`,
    )

    detailNotifications.value = body.notifications
    notificationsLoaded.value = true
  }

  /**
   * Send a hand-written push to this client. The backend rejects up front when
   * push is unconfigured (503 push_disabled) or the client has no device holding
   * an FCM token (409 no_push_devices), so a success here means it really was
   * handed to FCM — not merely accepted.
   */
  async function sendPush(id: string, input: SendPushInput): Promise<{ deviceCount: number }> {
    const body = await api<{ notificationId: string | null; deviceCount: number; duplicate: boolean }>(
      `/admin/notifications/push`,
      { method: 'POST', body: JSON.stringify({ userId: Number(id), ...input }) },
    )

    // The new row won't be in the cached history — refetch rather than guess.
    await fetchDetailNotifications(id, true)

    return { deviceCount: body.deviceCount }
  }

  return {
    clients,
    loading,
    error,

    detail,
    detailDeals,
    detailScoring,
    detailPayments,
    detailNotifications,

    detailLoading,

    dealsLoaded,
    scoringLoaded,
    paymentsLoaded,
    notificationsLoaded,

    hasDetail,

    fetchAll,
    fetchDetail,
    fetchDetailDeals,
    fetchDetailScoring,
    fetchDetailPayments,
    fetchDetailNotifications,
    sendPush,
  }
})
