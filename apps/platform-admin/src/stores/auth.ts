import { defineStore } from 'pinia'
import type { PlatformAdmin } from '@/types'

interface MockCredential {
  password: string
  admin: PlatformAdmin
}

const MOCK_DB: Record<string, MockCredential> = {
  'platform@scoring.uz': {
    password: 'admin123',
    admin: {
      id: 'padm_001',
      fullName: 'Operations Lead',
      email: 'platform@scoring.uz',
    },
  },
}

interface AuthState {
  admin: PlatformAdmin | null
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    admin: null,
  }),

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
    /** Validate credentials. Returns the matched admin or null. */
    validate(email: string, password: string): PlatformAdmin | null {
      const record = MOCK_DB[email.trim().toLowerCase()]
      if (!record || record.password !== password) return null
      return record.admin
    },

    login(admin: PlatformAdmin) {
      this.admin = admin
    },

    logout() {
      this.admin = null
    },
  },
})
