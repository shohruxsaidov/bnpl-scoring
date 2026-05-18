import { defineStore } from 'pinia'
import type { Client } from '@/types'

/** The single mock client this portal recognises. */
const MOCK_CLIENT: Client = {
  id: 'cli_001',
  fullName: 'Jasur Rahimov',
  phone: '+998 91 555 22 33',
  pinfl: '31203016740011',
  passportSerial: 'AB 4521098',
}

/** Normalise a phone string down to digits only for comparison. */
function digits(input: string): string {
  return input.replace(/\D/g, '')
}

interface AuthState {
  client: Client | null
  /** phone the OTP was "sent" to (digits only) */
  pendingPhone: string
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    client: null,
    pendingPhone: '',
  }),

  getters: {
    isAuthenticated: (s): boolean => s.client !== null,
  },

  actions: {
    /**
     * Validate the phone number and "send" an OTP.
     * Returns true if the phone matches the known mock client.
     */
    requestOtp(phone: string): boolean {
      const d = digits(phone)
      const known = digits(MOCK_CLIENT.phone)
      if (d !== known) return false
      this.pendingPhone = d
      return true
    },

    /**
     * Verify the OTP. Any 4-digit code is accepted in the mock.
     * Establishes a session on success.
     */
    verifyOtp(code: string): boolean {
      if (!/^\d{4}$/.test(code)) return false
      if (!this.pendingPhone) return false
      this.client = MOCK_CLIENT
      this.pendingPhone = ''
      return true
    },

    logout() {
      this.client = null
      this.pendingPhone = ''
    },
  },
})
