import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import type { EmployeeRole } from '@/types'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export type Permission = string

export interface AuthEmployee {
  id: string
  fullName: string
  phone: string
  merchantId: string
  branchId: string
  mustChangePassword: boolean
}

interface RolePickerState {
  token: string
  roles: EmployeeRole[]
  user: { id: string; fullName: string; phone: string }
}

function extractPermissions(user: any): Permission[] {
  return Array.isArray(user.permissions) ? user.permissions : []
}

export const useAuthStore = defineStore('auth', () => {
  const employee = ref<AuthEmployee | null>(null)
  const activeRole = ref<EmployeeRole | null>(null)
  const permissions = ref<Permission[]>([])
  const rolePicker = ref<RolePickerState | null>(null)

  const isAuthenticated = computed(() => employee.value !== null && activeRole.value !== null)
  const isAdmin = computed(() => activeRole.value === 'merchant_admin')
  const isAgent = computed(() => activeRole.value === 'agent')
  const requiresRolePicker = computed(() => rolePicker.value !== null)
  const roleLabel = computed(() => {
    if (activeRole.value === 'merchant_admin') return 'Merchant Admin'
    return 'Agent'
  })

  function can(feature: Permission): boolean {
    return permissions.value.includes(feature)
  }

  async function login(phone: string, password: string): Promise<void> {
    const res = await fetch(`${API}/auth/merchant/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ phone, password }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.code ?? 'error')
    }
    const body = await res.json()

    if (body.requiresRolePicker) {
      rolePicker.value = {
        token: body.pickerToken,
        roles: body.roles,
        user: body.user,
      }
    } else {
      employee.value = body.user
      activeRole.value = body.user.role
      permissions.value = extractPermissions(body.user)
      rolePicker.value = null
    }
  }

  async function selectRole(role: EmployeeRole): Promise<void> {
    if (!rolePicker.value) throw new Error('no picker state')
    const res = await fetch(`${API}/auth/merchant/select-role`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ pickerToken: rolePicker.value.token, role }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.code ?? 'error')
    }
    const body = await res.json()
    employee.value = body.user
    activeRole.value = body.user.role
    permissions.value = extractPermissions(body.user)
    rolePicker.value = null
  }

  async function restoreSession(): Promise<void> {
    const tryMe = async (): Promise<boolean> => {
      const res = await fetch(`${API}/auth/merchant/me`, { credentials: 'include' })
      if (!res.ok) return false
      const body = await res.json()
      employee.value = body.user
      activeRole.value = body.user.role
      permissions.value = extractPermissions(body.user)
      return true
    }

    if (await tryMe()) return

    const refreshRes = await fetch(`${API}/auth/merchant/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
    if (refreshRes.ok) await tryMe()
  }

  async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const res = await fetch(`${API}/auth/merchant/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ currentPassword, newPassword }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.code ?? 'error')
    }
    if (employee.value) {
      employee.value.mustChangePassword = false
    }
  }

  async function logout(): Promise<void> {
    await fetch(`${API}/auth/merchant/logout`, {
      method: 'POST',
      credentials: 'include',
    }).catch(() => {})
    employee.value = null
    activeRole.value = null
    permissions.value = []
    rolePicker.value = null
  }

  return {
    employee,
    activeRole,
    permissions,
    rolePicker,
    isAuthenticated,
    isAdmin,
    isAgent,
    requiresRolePicker,
    roleLabel,
    can,
    login,
    selectRole,
    restoreSession,
    changePassword,
    logout,
  }
})
