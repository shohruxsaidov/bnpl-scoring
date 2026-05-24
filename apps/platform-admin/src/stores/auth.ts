import { defineStore } from 'pinia'
import type { PlatformAdmin } from '@/types'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

interface AuthState {
  admin: PlatformAdmin | null
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({ admin: null }),

  getters: {
    isAuthenticated: (s): boolean => s.admin !== null,
    initials: (s): string =>
      s.admin
        ? s.admin.fullName
            .split(' ')
            .map((p) => p.charAt(0))
            .slice(0, 2)
            .join('')
            .toUpperCase()
        : '',
  },

  actions: {
    async login(email: string, password: string): Promise<void> {
      const res = await fetch(`${API}/auth/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.code ?? 'error')
      }
      const body = await res.json()
      this.admin = body.user
    },

    async logout(): Promise<void> {
      await fetch(`${API}/auth/admin/logout`, {
        method: 'POST',
        credentials: 'include',
      }).catch(() => {})
      this.admin = null
    },
  },
})
