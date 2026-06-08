import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { apiFetch as api } from '@/utils/apiFetch'
import type { AdminUser } from '@/types'

export const useEmployeesStore = defineStore('employees', () => {
  const users = ref<AdminUser[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const activeCount = computed(() => users.value.filter((u) => u.active).length)

  function forTenant(_id: string): AdminUser[] {
    return []
  }

  function activeForTenant(_id: string): number {
    return 0
  }

  async function fetchAll(): Promise<void> {
    loading.value = true
    error.value = null

    try {
      const body = await api<{ users: AdminUser[] }>('/admin/users')
      users.value = body.users
    } catch (e) {
      error.value = (e as Error).message
      throw e
    } finally {
      loading.value = false
    }
  }

  async function createUser(input: {
    email: string
    fullName: string
    password: string
    roleId: string
  }): Promise<AdminUser> {
    const body = await api<{ user: AdminUser }>('/admin/users', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    users.value.push(body.user)
    return body.user
  }

  async function setActive(id: string, active: boolean): Promise<void> {
    const body = await api<{ user: AdminUser }>(`/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ active }),
    })
    const idx = users.value.findIndex((u) => u.id === id)
    if (idx >= 0) users.value[idx] = body.user
  }

  return {
    users,
    loading,
    error,
    activeCount,
    forTenant,
    activeForTenant,
    fetchAll,
    createUser,
    setActive,
  }
})
