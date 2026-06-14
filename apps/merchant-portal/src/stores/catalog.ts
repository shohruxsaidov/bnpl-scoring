import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { apiFetch as api } from '@/utils/apiFetch'
import type { Branch, Category, Employee, Product, Tariff } from '@/types'

export const useCatalogStore = defineStore('catalog', () => {
  const categories = ref<Category[]>([])
  const products = ref<Product[]>([])
  const branches = ref<Branch[]>([])
  const employees = ref<Employee[]>([])
  const tariffs = ref<Tariff[]>([])
  const loading = ref(false)

  const categoryName = computed(() => (id: string): string =>
    categories.value.find((c) => c.id === id)?.name ?? '—',
  )
  const branchName = computed(() => (id: string): string =>
    branches.value.find((b) => b.id === id)?.name ?? '—',
  )
  const productsByCategory = computed(() => (id: string | null): Product[] =>
    id ? products.value.filter((p) => p.categoryId === id) : products.value,
  )
  const activeBranches = computed(() => branches.value.filter((b) => b.active))
  const activeTariffs = computed(() => tariffs.value.filter((t) => t.active))

  async function fetchAll() {
    loading.value = true

    try {
      const [catRes, prodRes, branchRes, empRes, tariffRes] = await Promise.all([
        api<{ categories: Category[] }>('/merchant/catalog/categories'),
        api<{ products: Product[] }>('/merchant/catalog/products'),
        api<{ branches: Branch[] }>('/merchant/branches'),
        api<{ employees: Employee[] }>('/merchant/employees'),
        api<{ tariffs: Tariff[] }>('/merchant/tariffs'),
      ])
      categories.value = catRes.categories
      products.value = prodRes.products
      branches.value = branchRes.branches
      employees.value = empRes.employees
      tariffs.value = tariffRes.tariffs
    } finally {
      loading.value = false
    }
  }

  async function enableCategory(categoryId: string) {
    await api(`/merchant/catalog/categories/${categoryId}`, { method: 'POST' })
    await fetchCategories()
  }

  async function disableCategory(categoryId: string) {
    await api(`/merchant/catalog/categories/${categoryId}`, { method: 'DELETE' })
    categories.value = categories.value.filter((c) => c.id !== categoryId)
  }

  async function addProduct(input: { name: string; categoryId: string; price: string; mxikCode?: string; packageCode?: number; packageName?: string }) {
    const body = await api<{ product: Product }>('/merchant/catalog/products', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    products.value.push(body.product)
  }

  async function updateProduct(id: string, patch: Partial<{ name: string; categoryId: string; price: string; mxikCode: string; packageCode: number; packageName: string; active: boolean }>) {
    const body = await api<{ product: Product }>(`/merchant/catalog/products/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
    const idx = products.value.findIndex((p) => p.id === id)
    if (idx >= 0) products.value[idx] = body.product
  }

  async function deleteProduct(id: string) {
    await api(`/merchant/catalog/products/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ active: false }),
    })
    products.value = products.value.filter((p) => p.id !== id)
  }

  async function addBranch(input: { name: string; address: string; phone: string; regionId?: number }) {
    const body = await api<{ branch: Branch }>('/merchant/branches', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    branches.value.push(body.branch)
  }

  async function updateBranch(id: string, patch: Partial<{ name: string; address: string; phone: string; active: boolean; regionId: number }>) {
    const body = await api<{ branch: Branch }>(`/merchant/branches/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
    const idx = branches.value.findIndex((b) => b.id === id)
    if (idx >= 0) branches.value[idx] = body.branch
  }

  async function addEmployee(input: { phone: string; password: string; fullName: string; branchId: string; roles: string[] }) {
    const body = await api<{ employee: Employee }>('/merchant/employees', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    employees.value.push(body.employee)
  }

  async function updateEmployee(id: string, patch: Partial<{ fullName: string; branchId: string; roles: string[]; active: boolean }>) {
    const body = await api<{ employee: Employee }>(`/merchant/employees/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
    const idx = employees.value.findIndex((e) => e.id === id)
    if (idx >= 0) employees.value[idx] = body.employee
  }

  async function toggleEmployeeActive(id: string) {
    const emp = employees.value.find((e) => e.id === id)
    if (emp) await updateEmployee(id, { active: !emp.active })
  }

  async function fetchEmployees() {
    if (employees.value.length) return
    loading.value = true

    try {
      const res = await api<{ employees: Employee[] }>('/merchant/employees')
      employees.value = res.employees
    } finally {
      loading.value = false
    }
  }

  async function fetchBranches() {
    if (branches.value.length) return
    loading.value = true

    try {
      const res = await api<{ branches: Branch[] }>('/merchant/branches')
      branches.value = res.branches
    } finally {
      loading.value = false
    }
  }

  async function fetchProducts() {
    if (products.value.length) return
    loading.value = true

    try {
      const res = await api<{ products: Product[] }>('/merchant/catalog/products')
      products.value = res.products
    } finally {
      loading.value = false
    }
  }

  async function fetchCategories() {
    if (categories.value.length) return
    loading.value = true

    try {
      const res = await api<{ categories: Category[] }>('/merchant/catalog/categories')
      categories.value = res.categories
    } finally {
      loading.value = false
    }
  }

  async function fetchCatalog() {
    if (products.value.length && categories.value.length) return
    const [catRes, prodRes] = await Promise.all([
      api<{ categories: Category[] }>('/merchant/catalog/categories'),
      api<{ products: Product[] }>('/merchant/catalog/products'),
    ])
    categories.value = catRes.categories
    products.value = prodRes.products
  }

  async function fetchTariffs() {
    if (tariffs.value.length) return
    loading.value = true

    try {
      const body = await api<{ tariffs: Tariff[] }>('/merchant/tariffs')
      tariffs.value = body.tariffs
    } finally {
      loading.value = false
    }
  }

  return {
    categories,
    products,
    branches,
    employees,
    tariffs,
    loading,
    categoryName,
    branchName,
    productsByCategory,
    activeBranches,
    activeTariffs,
    fetchAll,
    enableCategory,
    disableCategory,
    addProduct,
    updateProduct,
    deleteProduct,
    addBranch,
    updateBranch,
    addEmployee,
    updateEmployee,
    toggleEmployeeActive,
    fetchEmployees,
    fetchBranches,
    fetchProducts,
    fetchCategories,
    fetchCatalog,
    fetchTariffs,
  }
})
