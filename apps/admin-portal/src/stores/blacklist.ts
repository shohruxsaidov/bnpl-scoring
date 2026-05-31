import { defineStore } from 'pinia'
import { apiFetch as api } from '@/utils/apiFetch'
import type { BlacklistEntry, BlacklistEntryType } from '@/types'

interface BlacklistState {
  entries: BlacklistEntry[]
  loading: boolean
  error: string | null
}

export const useBlacklistStore = defineStore('blacklist', {
  state: (): BlacklistState => ({ entries: [], loading: false, error: null }),

  actions: {
    async fetchAll(): Promise<void> {
      this.loading = true
      this.error = null
      try {
        const body = await api<{ entries: BlacklistEntry[] }>('/admin/blacklist')
        this.entries = body.entries
      } catch (e) {
        this.error = (e as Error).message
        throw e
      } finally {
        this.loading = false
      }
    },

    async add(input: { type: BlacklistEntryType; value: string; reason: string }): Promise<BlacklistEntry> {
      const body = await api<{ entry: BlacklistEntry }>('/admin/blacklist', {
        method: 'POST',
        body: JSON.stringify(input),
      })
      this.entries.unshift(body.entry)
      return body.entry
    },

    async remove(id: string): Promise<void> {
      await api(`/admin/blacklist/${id}`, { method: 'DELETE' })
      this.entries = this.entries.filter((e) => e.id !== id)
    },
  },
})
