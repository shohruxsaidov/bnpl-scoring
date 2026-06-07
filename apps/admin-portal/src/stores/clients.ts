import { defineStore } from 'pinia'
import { apiFetch as api } from '@/utils/apiFetch'
import type { Client } from '@/types'

interface ClientsState {
  clients: Client[]
  loading: boolean
  error: string | null
}

export const useClientsStore = defineStore('clients', {
  state: (): ClientsState => ({
    clients: [],
    loading: false,
    error: null,
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
  },
})
