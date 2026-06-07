import { defineStore } from 'pinia'
import { apiFetch as api } from '@/utils/apiFetch'
import type { Client, ClientOverview, ClientDeal, ClientScoringEntry, ClientPaymentRow } from '@/types'

interface ClientsState {
  clients: Client[]
  loading: boolean
  error: string | null
  detail: ClientOverview | null
  detailDeals: ClientDeal[]
  detailScoring: ClientScoringEntry[]
  detailPayments: ClientPaymentRow[]
  detailLoading: boolean
  dealsLoaded: boolean
  scoringLoaded: boolean
  paymentsLoaded: boolean
}

export const useClientsStore = defineStore('clients', {
  state: (): ClientsState => ({
    clients: [],
    loading: false,
    error: null,
    detail: null,
    detailDeals: [],
    detailScoring: [],
    detailPayments: [],
    detailLoading: false,
    dealsLoaded: false,
    scoringLoaded: false,
    paymentsLoaded: false,
  }),

  actions: {
    async fetchAll(): Promise<void> {
      this.loading = true
      this.error = null
      try {
        const body = await api<{ clients: Client[] }>('/admin/clients')
        this.clients = body.clients
      } catch (e) {
        this.error = (e as Error).message
        throw e
      } finally {
        this.loading = false
      }
    },

    async fetchDetail(id: string): Promise<void> {
      this.detail = null
      this.detailDeals = []
      this.detailScoring = []
      this.detailPayments = []
      this.dealsLoaded = false
      this.scoringLoaded = false
      this.paymentsLoaded = false
      this.detailLoading = true
      try {
        this.detail = await api<ClientOverview>(`/admin/clients/${id}`)
      } finally {
        this.detailLoading = false
      }
    },

    async fetchDetailDeals(id: string): Promise<void> {
      if (this.dealsLoaded) return
      const body = await api<{ deals: ClientDeal[] }>(`/admin/clients/${id}/deals`)
      this.detailDeals = body.deals
      this.dealsLoaded = true
    },

    async fetchDetailScoring(id: string): Promise<void> {
      if (this.scoringLoaded) return
      const body = await api<{ history: ClientScoringEntry[] }>(`/admin/clients/${id}/scoring`)
      this.detailScoring = body.history
      this.scoringLoaded = true
    },

    async fetchDetailPayments(id: string): Promise<void> {
      if (this.paymentsLoaded) return
      const body = await api<{ payments: ClientPaymentRow[] }>(`/admin/clients/${id}/payments`)
      this.detailPayments = body.payments
      this.paymentsLoaded = true
    },
  },
})
