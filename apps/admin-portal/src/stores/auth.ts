import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import type { PlatformAdmin } from '@/types'

const API = import.meta.env.VITE_API_URL ?? ''

export const useAuthStore = defineStore('auth', () => {
  const admin = ref<PlatformAdmin | null>(null)

  const isAuthenticated = computed(() => admin.value !== null)
  const isSuperadmin = computed(() => admin.value?.isSuperadmin ?? false)

  const initials = computed(() => {
    if (!admin.value) return ''
    return admin.value.fullName
      .split(' ')
      .map((p) => p.charAt(0))
      .slice(0, 2)
      .join('')
      .toUpperCase()
  })

  function can(feature: string): boolean {
    return (admin.value?.isSuperadmin ?? false) || (admin.value?.permissions?.includes(feature) ?? false)
  }

  async function restoreSession(): Promise<void> {
    const tryMe = async (): Promise<boolean> => {
      const res = await fetch(`${API}/auth/admin/me`, { credentials: 'include' })
      if (!res.ok) return false
      const body = await res.json()
      admin.value = body.user
      return true
    }

    if (await tryMe()) return

    const refreshRes = await fetch(`${API}/auth/admin/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
    if (refreshRes.ok) await tryMe()
  }

  async function login(email: string, password: string): Promise<void> {
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
    admin.value = body.user
  }

  async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const res = await fetch(`${API}/auth/admin/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ currentPassword, newPassword }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.code ?? 'error')
    }
    if (admin.value) {
      admin.value.mustChangePassword = false
    }
  }

  async function logout(): Promise<void> {
    await fetch(`${API}/auth/admin/logout`, {
      method: 'POST',
      credentials: 'include',
    }).catch(() => {})
    admin.value = null
  }

  return { admin, isAuthenticated, isSuperadmin, initials, can, restoreSession, login, changePassword, logout }
})
