import { defineStore } from 'pinia'
import type { EmployeeRole } from '@/types'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export interface AuthEmployee {
  id: string
  fullName: string
  email: string
  merchantId: string
  branchId: string
}

interface RolePickerState {
  token: string
  roles: EmployeeRole[]
  user: { id: string; fullName: string; email: string }
}

interface AuthState {
  employee: AuthEmployee | null
  activeRole: EmployeeRole | null
  rolePicker: RolePickerState | null
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    employee: null,
    activeRole: null,
    rolePicker: null,
  }),

  getters: {
    isAuthenticated: (s): boolean => s.employee !== null && s.activeRole !== null,
    isAdmin: (s): boolean => s.activeRole === 'merchant_admin',
    isAgent: (s): boolean => s.activeRole === 'agent',
    requiresRolePicker: (s): boolean => s.rolePicker !== null,
    roleLabel: (s): string => {
      if (s.activeRole === 'merchant_admin') return 'Merchant Admin'
      if (s.activeRole === 'branch_admin') return 'Branch Admin'
      return 'Agent'
    },
  },

  actions: {
    async login(email: string, password: string): Promise<void> {
      const res = await fetch(`${API}/auth/merchant/login`, {
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

      if (body.requiresRolePicker) {
        this.rolePicker = { token: body.pickerToken, roles: body.roles, user: body.user }
      } else {
        this.employee = body.user
        this.activeRole = body.user.role
        this.rolePicker = null
      }
    },

    async selectRole(role: EmployeeRole): Promise<void> {
      if (!this.rolePicker) throw new Error('no picker state')
      const res = await fetch(`${API}/auth/merchant/select-role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ pickerToken: this.rolePicker.token, role }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.code ?? 'error')
      }
      const body = await res.json()
      this.employee = body.user
      this.activeRole = body.user.role
      this.rolePicker = null
    },

    async logout(): Promise<void> {
      await fetch(`${API}/auth/merchant/logout`, {
        method: 'POST',
        credentials: 'include',
      }).catch(() => {})
      this.employee = null
      this.activeRole = null
      this.rolePicker = null
    },
  },
})
