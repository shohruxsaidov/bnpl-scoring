import { ref } from 'vue'
import { defineStore } from 'pinia'
import { apiFetch as api } from '@/utils/apiFetch'
import type { Category } from '@/types'

export const useCategoriesStore = defineStore('categories', () => {
  const categories = ref<Category[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchAll(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const body = await api<{ categories: Category[] }>('/admin/categories')
      categories.value = body.categories
    } catch (e) {
      error.value = (e as Error).message
      throw e
    } finally {
      loading.value = false
    }
  }

  async function create(name: string): Promise<Category> {
    const body = await api<{ category: Category }>('/admin/categories', {
      method: 'POST',
      body: JSON.stringify({ name }),
    })
    categories.value.unshift(body.category)
    return body.category
  }

  async function update(id: string, data: Partial<Pick<Category, 'name' | 'active'>>): Promise<void> {
    const body = await api<{ category: Category }>(`/admin/categories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
    const idx = categories.value.findIndex((c) => c.id === id)
    if (idx !== -1) categories.value[idx] = body.category
  }

  return { categories, loading, error, fetchAll, create, update }
})
