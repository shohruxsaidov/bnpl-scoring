import { defineStore } from 'pinia'
import { apiFetch as api } from '@/utils/apiFetch'
import type { AdminUser } from '@/types'

interface EmployeesState {
  users: AdminUser[]
  loading: boolean
  error: string | null
}

export const useEmployeesStore = defineStore('employees', {
  state: (): EmployeesState => ({
    users: [],
    loading: false,
    error: null,
  }),

  getters: {
    activeCount: (s): number => s.users.filter((u) => u.active).length,
    // TenantDetailView compat — returns empty until that view is migrated
    forTenant: () => (_id: string): AdminUser[] => [],
    activeForTenant: () => (_id: string): number => 0,
  },

  actions: {
    async fetchAll(): Promise<void> {
      this.loading = true
      this.error = null
      try {
        const body = await api<{ users: AdminUser[] }>('/admin/users')
        this.users = body.users
      } catch (e) {
        this.error = (e as Error).message
        throw e
      } finally {
        this.loading = false
      }
    },

    async createUser(input: {
      email: string
      fullName: string
      password: string
      roleId: string
    }): Promise<AdminUser> {
      const body = await api<{ user: AdminUser }>('/admin/users', {
        method: 'POST',
        body: JSON.stringify(input),
      })
      this.users.push(body.user)
      return body.user
    },

    async setActive(id: string, active: boolean): Promise<void> {
      const body = await api<{ user: AdminUser }>(`/admin/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active }),
      })
      const idx = this.users.findIndex((u) => u.id === id)
      if (idx >= 0) this.users[idx] = body.user
    },
  },
})
