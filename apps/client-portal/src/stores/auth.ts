import { defineStore } from 'pinia'
import type { AuthUser } from '@/types'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

interface AuthState {
  user: AuthUser | null
  pendingPhone: string
  /** Dev-only OTP echoed by the API (NODE_ENV !== 'production'). */
  devOtp: string
}

/** Throw an Error carrying the API error `code` for failed responses. */
async function ensureOk(res: Response): Promise<unknown> {
  if (res.ok) return res.json().catch(() => ({}))
  const body = (await res.json().catch(() => ({}))) as { code?: string }
  throw new Error(body.code ?? 'error')
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({ user: null, pendingPhone: '', devOtp: '' }),

  getters: {
    isAuthenticated: (s): boolean => s.user !== null,
  },

  actions: {
    async requestLoginOtp(phone: string): Promise<void> {
      const res = await fetch(`${API}/auth/client/login/phone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phone }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(body.code ?? 'error')
      }
      this.pendingPhone = phone
      this.devOtp = body.devOtp ?? ''
    },

    async verifyLoginOtp(code: string): Promise<void> {
      const res = await fetch(`${API}/auth/client/login/otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phone: this.pendingPhone, code }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.code ?? 'error')
      }
      const body = await res.json()
      this.user = body.user
      this.pendingPhone = ''
      this.devOtp = ''
    },

    async logout(): Promise<void> {
      await fetch(`${API}/auth/client/logout`, { method: 'POST', credentials: 'include' }).catch(() => {})
      this.user = null
    },

    setUser(user: AuthUser) {
      this.user = user
    },
  },
})

/** Base API URL, shared with the registration wizard. */
export const API_URL = API
export { ensureOk }
