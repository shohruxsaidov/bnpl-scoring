import { ref } from 'vue'
import { defineStore } from 'pinia'

import { apiFetch as api } from '@/utils/apiFetch'
import type { BlacklistEntry, BlacklistEntryType } from '@/types'

export const useBlacklistStore = defineStore('blacklist', () => {
  const entries = ref<BlacklistEntry[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchAll(): Promise<void> {
    loading.value = true
    error.value = null

    try {
      const body = await api<{ entries: BlacklistEntry[] }>('/admin/blacklist')
      entries.value = body.entries
    } catch (e) {
      error.value = (e as Error).message
      throw e
    } finally {
      loading.value = false
    }
  }

  async function add(input: { type: BlacklistEntryType; value: string; reason: string }): Promise<BlacklistEntry> {
    const body = await api<{ entry: BlacklistEntry }>('/admin/blacklist', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    entries.value.unshift(body.entry)
    return body.entry
  }

  async function remove(id: string): Promise<void> {
    await api(`/admin/blacklist/${id}`, { method: 'DELETE' })
    entries.value = entries.value.filter((e) => e.id !== id)
  }

  return { entries, loading, error, fetchAll, add, remove }
})
