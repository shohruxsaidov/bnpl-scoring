import { defineStore } from 'pinia'
import { apiFetch as api } from '@/utils/apiFetch'
import type { Branch, Category, Employee, Product, Tariff } from '@/types'


interface CatalogState {
  categories: Category[]
  products: Product[]
  branches: Branch[]
  employees: Employee[]
  tariffs: Tariff[]
  loading: boolean
}

export const useCatalogStore = defineStore('catalog', {
  state: (): CatalogState => ({
    categories: [],
    products: [],
    branches: [],
    employees: [],
    tariffs: [],
    loading: false,
  }),

  getters: {
    categoryName: (s) => (id: string): string => s.categories.find((c) => c.id === id)?.name ?? '—',
    branchName: (s) => (id: string): string => s.branches.find((b) => b.id === id)?.name ?? '—',
    productsByCategory: (s) => (id: string | null): Product[] =>
      id ? s.products.filter((p) => p.categoryId === id) : s.products,
    activeBranches: (s): Branch[] => s.branches.filter((b) => b.active),
    activeTariffs: (s): Tariff[] => s.tariffs.filter((t) => t.active && t.selected),
  },

  // -- Tariff helpers (kept as mock until tariffs API is wired) --

  actions: {
    async fetchAll() {
      this.loading = true
      try {
        const [catRes, prodRes, branchRes, empRes, tariffRes] = await Promise.all([
          api<{ categories: Category[] }>('/merchant/catalog/categories'),
          api<{ products: Product[] }>('/merchant/catalog/products'),
          api<{ branches: Branch[] }>('/merchant/branches'),
          api<{ employees: Employee[] }>('/merchant/employees'),
          api<{ tariffs: Tariff[] }>('/merchant/tariffs'),
        ])
        this.categories = catRes.categories
        this.products = prodRes.products
        this.branches = branchRes.branches
        this.employees = empRes.employees
        this.tariffs = tariffRes.tariffs
      } finally {
        this.loading = false
      }
    },

    // -- Categories --
    async addCategory(name: string) {
      const body = await api<{ category: Category }>('/merchant/catalog/categories', {
        method: 'POST',
        body: JSON.stringify({ name }),
      })
      this.categories.push(body.category)
    },

    async updateCategory(id: string, name: string) {
      const body = await api<{ category: Category }>(`/merchant/catalog/categories/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      })
      const idx = this.categories.findIndex((c) => c.id === id)
      if (idx >= 0) this.categories[idx] = body.category
    },

    async deleteCategory(id: string) {
      await api(`/merchant/catalog/categories/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: false }),
      })
      this.categories = this.categories.filter((c) => c.id !== id)
    },

    // -- Products --
    async addProduct(input: { name: string; categoryId: string; tanNarxi: string; mxikCode?: string; packageCode?: number; packageName?: string }) {
      const body = await api<{ product: Product }>('/merchant/catalog/products', {
        method: 'POST',
        body: JSON.stringify(input),
      })
      this.products.push(body.product)
    },

    async updateProduct(id: string, patch: Partial<{ name: string; categoryId: string; tanNarxi: string; mxikCode: string; packageCode: number; packageName: string; active: boolean }>) {
      const body = await api<{ product: Product }>(`/merchant/catalog/products/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      })
      const idx = this.products.findIndex((p) => p.id === id)
      if (idx >= 0) this.products[idx] = body.product
    },

    async deleteProduct(id: string) {
      await api(`/merchant/catalog/products/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: false }),
      })
      this.products = this.products.filter((p) => p.id !== id)
    },

    // -- Branches --
    async addBranch(input: { name: string; address: string; phone: string }) {
      const body = await api<{ branch: Branch }>('/merchant/branches', {
        method: 'POST',
        body: JSON.stringify(input),
      })
      this.branches.push(body.branch)
    },

    async updateBranch(id: string, patch: Partial<{ name: string; address: string; phone: string; active: boolean }>) {
      const body = await api<{ branch: Branch }>(`/merchant/branches/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      })
      const idx = this.branches.findIndex((b) => b.id === id)
      if (idx >= 0) this.branches[idx] = body.branch
    },

    // -- Employees --
    async addEmployee(input: { email: string; password: string; fullName: string; branchId: string; roles: string[] }) {
      const body = await api<{ employee: Employee }>('/merchant/employees', {
        method: 'POST',
        body: JSON.stringify(input),
      })
      this.employees.push(body.employee)
    },

    async updateEmployee(id: string, patch: Partial<{ fullName: string; branchId: string; roles: string[]; active: boolean }>) {
      const body = await api<{ employee: Employee }>(`/merchant/employees/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      })
      const idx = this.employees.findIndex((e) => e.id === id)
      if (idx >= 0) this.employees[idx] = body.employee
    },

    async toggleEmployeeActive(id: string) {
      const emp = this.employees.find((e) => e.id === id)
      if (emp) await this.updateEmployee(id, { active: !emp.active })
    },

    async fetchTariffs() {
      const body = await api<{ tariffs: Tariff[] }>('/merchant/tariffs')
      this.tariffs = body.tariffs
    },

    async selectTariff(id: string) {
      await api(`/merchant/tariffs/${id}`, { method: 'POST' })
      const t = this.tariffs.find((x) => x.id === id)
      if (t) t.selected = true
    },

    async deselectTariff(id: string) {
      await api(`/merchant/tariffs/${id}`, { method: 'DELETE' })
      const t = this.tariffs.find((x) => x.id === id)
      if (t) t.selected = false
    },
  },
})
