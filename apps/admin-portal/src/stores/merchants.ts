import { defineStore } from 'pinia'
import type {
  Branch,
  Category,
  Merchant,
  MerchantDocument,
  MerchantEmployee,
  Product,
} from '@/types'

import { apiFetch as api } from '@/utils/apiFetch'

interface MerchantsState {
  merchants: Merchant[]
  branches: Record<string, Branch[]>
  employees: Record<string, MerchantEmployee[]>
  categories: Record<string, Category[]>
  products: Record<string, Product[]>
  documents: Record<string, MerchantDocument[]>
  loading: boolean
  error: string | null
}

export const useMerchantsStore = defineStore('merchants', {
  state: (): MerchantsState => ({
    merchants: [],
    branches: {},
    employees: {},
    categories: {},
    products: {},
    documents: {},
    loading: false,
    error: null,
  }),

  getters: {
    byId: (s) => (id: string): Merchant | undefined => s.merchants.find((m) => m.id === id),
    branchesFor: (s) => (merchantId: string): Branch[] => s.branches[merchantId] ?? [],
    employeesForBranch: (s) => (branchId: string): MerchantEmployee[] =>
      s.employees[branchId] ?? [],
    categoriesFor: (s) => (merchantId: string): Category[] => s.categories[merchantId] ?? [],
    productsFor: (s) => (merchantId: string): Product[] => s.products[merchantId] ?? [],
    documentsFor: (s) => (merchantId: string): MerchantDocument[] => s.documents[merchantId] ?? [],
  },

  actions: {
    async fetchAll(): Promise<void> {
      this.loading = true
      this.error = null
      try {
        const body = await api<{ merchants: Merchant[] }>('/admin/merchants')
        this.merchants = body.merchants
      } catch (e) {
        this.error = (e as Error).message
        throw e
      } finally {
        this.loading = false
      }
    },

    async fetchOne(id: string): Promise<Merchant> {
      this.loading = true
      this.error = null
      try {
        const body = await api<{ merchant: Merchant }>(`/admin/merchants/${id}`)
        const idx = this.merchants.findIndex((m) => m.id === id)
        if (idx >= 0) this.merchants[idx] = body.merchant
        else this.merchants.push(body.merchant)
        return body.merchant
      } catch (e) {
        this.error = (e as Error).message
        throw e
      } finally {
        this.loading = false
      }
    },

    async create(input: {
      name: string
      legalName: string
      inn: string
      phone: string
      address: string
    }): Promise<Merchant> {
      const body = await api<{ merchant: Merchant }>('/admin/merchants', {
        method: 'POST',
        body: JSON.stringify(input),
      })
      this.merchants.unshift(body.merchant)
      return body.merchant
    },

    async update(id: string, patch: Partial<Merchant>): Promise<Merchant> {
      const body = await api<{ merchant: Merchant }>(`/admin/merchants/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      })
      const idx = this.merchants.findIndex((m) => m.id === id)
      if (idx >= 0) this.merchants[idx] = body.merchant
      return body.merchant
    },

    async fetchBranches(merchantId: string): Promise<void> {
      const body = await api<{ branches: Branch[] }>(`/admin/merchants/${merchantId}/branches`)
      this.branches[merchantId] = body.branches
    },

    async createBranch(
      merchantId: string,
      input: { name: string; address: string; phone: string },
    ): Promise<Branch> {
      const body = await api<{ branch: Branch }>(`/admin/merchants/${merchantId}/branches`, {
        method: 'POST',
        body: JSON.stringify(input),
      })
      this.branches[merchantId] = [...(this.branches[merchantId] ?? []), body.branch]
      return body.branch
    },

    async updateBranch(branchId: string, patch: Partial<Branch>): Promise<Branch> {
      const body = await api<{ branch: Branch }>(`/admin/branches/${branchId}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      })
      const merchantId = body.branch.merchantId
      const list = this.branches[merchantId]
      if (list) {
        const idx = list.findIndex((b) => b.id === branchId)
        if (idx >= 0) list[idx] = body.branch
      }
      return body.branch
    },

    async fetchEmployees(branchId: string): Promise<void> {
      const body = await api<{ employees: MerchantEmployee[] }>(
        `/admin/branches/${branchId}/employees`,
      )
      this.employees[branchId] = body.employees
    },

    async createEmployee(
      branchId: string,
      input: { email: string; password: string; fullName: string; roles: string[] },
    ): Promise<MerchantEmployee> {
      const body = await api<{ employee: MerchantEmployee }>(
        `/admin/branches/${branchId}/employees`,
        {
          method: 'POST',
          body: JSON.stringify(input),
        },
      )
      this.employees[branchId] = [...(this.employees[branchId] ?? []), body.employee]
      return body.employee
    },

    async updateEmployee(
      employeeId: string,
      patch: Partial<MerchantEmployee>,
    ): Promise<MerchantEmployee> {
      const body = await api<{ employee: MerchantEmployee }>(`/admin/employees/${employeeId}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      })
      const list = this.employees[body.employee.branchId]
      if (list) {
        const idx = list.findIndex((e) => e.id === employeeId)
        if (idx >= 0) list[idx] = body.employee
      }
      return body.employee
    },

    async changeEmployeePassword(employeeId: string, password: string): Promise<void> {
      await api(`/admin/employees/${employeeId}/change-password`, {
        method: 'POST',
        body: JSON.stringify({ password }),
      })
    },

    async fetchCategories(merchantId: string): Promise<void> {
      const body = await api<{ categories: Category[] }>(
        `/admin/merchants/${merchantId}/categories`,
      )
      this.categories[merchantId] = body.categories
    },

    async createCategory(merchantId: string, input: { name: string }): Promise<Category> {
      const body = await api<{ category: Category }>(`/admin/merchants/${merchantId}/categories`, {
        method: 'POST',
        body: JSON.stringify(input),
      })
      this.categories[merchantId] = [...(this.categories[merchantId] ?? []), body.category]
      return body.category
    },

    async updateCategory(categoryId: string, patch: Partial<Category>): Promise<Category> {
      const body = await api<{ category: Category }>(`/admin/categories/${categoryId}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      })
      const list = this.categories[body.category.merchantId]
      if (list) {
        const idx = list.findIndex((c) => c.id === categoryId)
        if (idx >= 0) list[idx] = body.category
      }
      return body.category
    },

    async fetchProducts(merchantId: string): Promise<void> {
      const body = await api<{ products: Product[] }>(`/admin/merchants/${merchantId}/products`)
      this.products[merchantId] = body.products
    },

    async createProduct(
      merchantId: string,
      input: { categoryId: string; name: string; price: string; mxikCode?: string; packageCode?: number; packageName?: string },
    ): Promise<Product> {
      const body = await api<{ product: Product }>(`/admin/merchants/${merchantId}/products`, {
        method: 'POST',
        body: JSON.stringify(input),
      })
      this.products[merchantId] = [...(this.products[merchantId] ?? []), body.product]
      return body.product
    },

    async updateProduct(productId: string, patch: Partial<Product>): Promise<Product> {
      const body = await api<{ product: Product }>(`/admin/products/${productId}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      })
      const list = this.products[body.product.merchantId]
      if (list) {
        const idx = list.findIndex((p) => p.id === productId)
        if (idx >= 0) list[idx] = body.product
      }
      return body.product
    },

    async fetchDocuments(merchantId: string): Promise<void> {
      const body = await api<{ documents: MerchantDocument[] }>(
        `/admin/merchants/${merchantId}/documents`,
      )
      this.documents[merchantId] = body.documents
    },

    async getUploadUrl(
      merchantId: string,
    ): Promise<{ uploadUrl: string; objectName: string }> {
      return api<{ uploadUrl: string; objectName: string }>(
        `/admin/merchants/${merchantId}/documents/upload-url`,
        { method: 'POST' },
      )
    },

    async recordDocument(
      merchantId: string,
      input: { fileUrl: string; documentType: string },
    ): Promise<MerchantDocument> {
      const body = await api<{ document: MerchantDocument }>(
        `/admin/merchants/${merchantId}/documents`,
        {
          method: 'POST',
          body: JSON.stringify(input),
        },
      )
      this.documents[merchantId] = [...(this.documents[merchantId] ?? []), body.document]
      return body.document
    },

    async uploadDocument(
      merchantId: string,
      file: File,
      documentType: string,
    ): Promise<MerchantDocument> {
      const { uploadUrl, objectName } = await this.getUploadUrl(merchantId)
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
      })
      if (!putRes.ok) throw new Error('upload_failed')
      return this.recordDocument(merchantId, { fileUrl: objectName, documentType })
    },
  },
})
