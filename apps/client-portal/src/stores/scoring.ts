import { defineStore } from 'pinia'
import { API_URL } from './auth'

export interface UserLimit {
  limitAmount: number
  scoredAt: string
}

interface ScoringState {
  limit: UserLimit | null
  loaded: boolean
}

export const useScoringStore = defineStore('scoring', {
  state: (): ScoringState => ({ limit: null, loaded: false }),

  actions: {
    async fetchLimit(): Promise<void> {
      try {
        const res = await fetch(`${API_URL}/client/scoring/limit`, { credentials: 'include' })
        if (!res.ok) return
        const data = await res.json()
        this.limit = data.limit ?? null
      } finally {
        this.loaded = true
      }
    },

    setLimit(limit: UserLimit) {
      this.limit = limit
      this.loaded = true
    },

    clearLimit() {
      this.limit = null
    },
  },
})
