import { defineStore } from 'pinia'
import type { Tariff } from '@/types'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    credentials: 'include',
    headers: init.body ? { 'Content-Type': 'application/json' } : undefined,
    ...init,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.code ?? body.message ?? `request_failed_${res.status}`)
  }
  return res.json() as Promise<T>
}

interface TariffsState {
  tariffs: Tariff[]
  loading: boolean
  error: string | null
}

export const useTariffsStore = defineStore('tariffs', {
  state: (): TariffsState => ({ tariffs: [], loading: false, error: null }),

  actions: {
    async fetchAll(): Promise<void> {
      this.loading = true
      this.error = null
      try {
        const body = await api<{ tariffs: Tariff[] }>('/admin/tariffs')
        this.tariffs = body.tariffs
      } catch (e) {
        this.error = (e as Error).message
        throw e
      } finally {
        this.loading = false
      }
    },

    async create(input: {
      name: string
      termMonths: number
      markupPercent: number
      creditMin: number
      creditMax: number
    }): Promise<Tariff> {
      const body = await api<{ tariff: Tariff }>('/admin/tariffs', {
        method: 'POST',
        body: JSON.stringify(input),
      })
      this.tariffs.unshift(body.tariff)
      return body.tariff
    },

    async update(id: string, patch: Partial<Omit<Tariff, 'id'>>): Promise<Tariff> {
      const body = await api<{ tariff: Tariff }>(`/admin/tariffs/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      })
      const idx = this.tariffs.findIndex((t) => t.id === id)
      if (idx >= 0) this.tariffs[idx] = body.tariff
      return body.tariff
    },

    async remove(id: string): Promise<void> {
      await api(`/admin/tariffs/${id}`, { method: 'DELETE' })
      this.tariffs = this.tariffs.filter((t) => t.id !== id)
    },
  },
})
