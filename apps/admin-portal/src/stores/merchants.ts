import { ref } from 'vue'
import { defineStore } from 'pinia'

import type {
  BankEntry,
  Branch,
  Category,
  Merchant,
  MerchantDocument,
  MerchantEmployee,
  Product,
  Tariff,
} from '@/types'


import { apiFetch as api } from '@/utils/apiFetch'

export const useMerchantsStore = defineStore('merchants', () => {
  const merchants = ref<Merchant[]>([])
  const branches = ref<Record<string, Branch[]>>({})
  const employees = ref<Record<string, MerchantEmployee[]>>({})
  const categories = ref<Record<string, Category[]>>({})
  const globalCategories = ref<Category[]>([])
  const products = ref<Record<string, Product[]>>({})
  const documents = ref<Record<string, MerchantDocument[]>>({})
  const merchantTariffs = ref<Record<string, Tariff[]>>({})
  const bankList = ref<BankEntry[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  function byId(id: string): Merchant | undefined {
    return merchants.value.find((m) => m.id === id)
  }

  function branchesFor(merchantId: string): Branch[] {
    return branches.value[merchantId] ?? []
  }

  function employeesForBranch(branchId: string): MerchantEmployee[] {
    return employees.value[branchId] ?? []
  }

  function categoriesFor(merchantId: string): Category[] {
    return categories.value[merchantId] ?? []
  }

  function productsFor(merchantId: string): Product[] {
    return products.value[merchantId] ?? []
  }

  function documentsFor(merchantId: string): MerchantDocument[] {
    return documents.value[merchantId] ?? []
  }

  function tariffsFor(merchantId: string): Tariff[] {
    return merchantTariffs.value[merchantId] ?? []
  }

  async function fetchAll(): Promise<void> {
    loading.value = true
    error.value = null

    try {
      const body = await api<{ merchants: Merchant[] }>('/admin/merchants')
      merchants.value = body.merchants
    } catch (e) {
      error.value = (e as Error).message
      throw e
    } finally {
      loading.value = false
    }
  }

  async function fetchOne(id: string): Promise<Merchant> {
    loading.value = true
    error.value = null

    try {
      const body = await api<{ merchant: Merchant }>(`/admin/merchants/${id}`)
      const idx = merchants.value.findIndex((m) => m.id === id)
      if (idx >= 0) merchants.value[idx] = body.merchant
      else merchants.value.push(body.merchant)
      return body.merchant
    } catch (e) {
      error.value = (e as Error).message
      throw e
    } finally {
      loading.value = false
    }
  }

  async function create(input: {
    name: string
    legalName: string
    inn: string
    phone: string
    address: string
    regionId?: number
  }): Promise<Merchant> {
    const body = await api<{ merchant: Merchant }>('/admin/merchants', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    merchants.value.unshift(body.merchant)
    return body.merchant
  }

  async function update(id: string, patch: Partial<Merchant>): Promise<Merchant> {
    const body = await api<{ merchant: Merchant }>(`/admin/merchants/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
    const idx = merchants.value.findIndex((m) => m.id === id)
    if (idx >= 0) merchants.value[idx] = body.merchant
    return body.merchant
  }

  async function fetchBranches(merchantId: string): Promise<void> {
    const body = await api<{ branches: Branch[] }>(`/admin/merchants/${merchantId}/branches`)
    branches.value[merchantId] = body.branches
  }

  async function createBranch(
    merchantId: string,
    input: { name: string; address: string; phone: string; regionId?: number },
  ): Promise<Branch> {
    const body = await api<{ branch: Branch }>(`/admin/merchants/${merchantId}/branches`, {
      method: 'POST',
      body: JSON.stringify(input),
    })
    branches.value[merchantId] = [...(branches.value[merchantId] ?? []), body.branch]
    return body.branch
  }

  async function updateBranch(branchId: string, patch: Partial<Branch>): Promise<Branch> {
    const body = await api<{ branch: Branch }>(`/admin/branches/${branchId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
    const merchantId = body.branch.merchantId
    const list = branches.value[merchantId]
    if (list) {
      const idx = list.findIndex((b) => b.id === branchId)
      if (idx >= 0) list[idx] = body.branch
    }
    return body.branch
  }

  async function fetchEmployees(branchId: string): Promise<void> {
    const body = await api<{ employees: MerchantEmployee[] }>(
      `/admin/branches/${branchId}/employees`,
    )
    employees.value[branchId] = body.employees
  }

  async function createEmployee(
    branchId: string,
    input: { phone: string; password: string; fullName: string; roles: string[] },
  ): Promise<MerchantEmployee> {
    const body = await api<{ employee: MerchantEmployee }>(
      `/admin/branches/${branchId}/employees`,
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
    )
    employees.value[branchId] = [...(employees.value[branchId] ?? []), body.employee]
    return body.employee
  }

  async function updateEmployee(
    employeeId: string,
    patch: Partial<MerchantEmployee>,
  ): Promise<MerchantEmployee> {
    const body = await api<{ employee: MerchantEmployee }>(`/admin/employees/${employeeId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
    const list = employees.value[body.employee.branchId]
    if (list) {
      const idx = list.findIndex((e) => e.id === employeeId)
      if (idx >= 0) list[idx] = body.employee
    }
    return body.employee
  }

  async function changeEmployeePassword(employeeId: string, password: string): Promise<void> {
    await api(`/admin/employees/${employeeId}/change-password`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    })
  }

  async function fetchGlobalCategories(): Promise<void> {
    const body = await api<{ categories: Category[] }>('/admin/categories')
    globalCategories.value = body.categories
  }

  async function fetchCategories(merchantId: string): Promise<void> {
    const body = await api<{ categories: Category[] }>(`/admin/merchants/${merchantId}/categories`)
    categories.value[merchantId] = body.categories
  }

  async function enableCategory(merchantId: string, categoryId: string): Promise<void> {
    await api(`/admin/merchants/${merchantId}/categories/${categoryId}`, { method: 'POST' })
    const cat = globalCategories.value.find((c) => c.id === categoryId)
    if (cat) categories.value[merchantId] = [...(categories.value[merchantId] ?? []), cat]
  }

  async function disableCategory(merchantId: string, categoryId: string): Promise<void> {
    await api(`/admin/merchants/${merchantId}/categories/${categoryId}`, { method: 'DELETE' })
    const list = categories.value[merchantId]
    if (list) categories.value[merchantId] = list.filter((c) => c.id !== categoryId)
  }

  async function fetchProducts(merchantId: string): Promise<void> {
    const body = await api<{ products: Product[] }>(`/admin/merchants/${merchantId}/products`)
    products.value[merchantId] = body.products
  }

  async function createProduct(
    merchantId: string,
    input: { categoryId: string; name: string; price: string; mxikCode?: string; packageCode?: number; packageName?: string },
  ): Promise<Product> {
    const body = await api<{ product: Product }>(`/admin/merchants/${merchantId}/products`, {
      method: 'POST',
      body: JSON.stringify(input),
    })
    products.value[merchantId] = [...(products.value[merchantId] ?? []), body.product]
    return body.product
  }

  async function updateProduct(productId: string, patch: Partial<Product>): Promise<Product> {
    const body = await api<{ product: Product }>(`/admin/products/${productId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
    const list = products.value[body.product.merchantId]
    if (list) {
      const idx = list.findIndex((p) => p.id === productId)
      if (idx >= 0) list[idx] = body.product
    }
    return body.product
  }

  async function fetchDocuments(merchantId: string): Promise<void> {
    const body = await api<{ documents: MerchantDocument[] }>(
      `/admin/merchants/${merchantId}/documents`,
    )
    documents.value[merchantId] = body.documents
  }

  async function getUploadUrl(
    merchantId: string,
  ): Promise<{ uploadUrl: string; objectName: string }> {
    return api<{ uploadUrl: string; objectName: string }>(
      `/admin/merchants/${merchantId}/documents/upload-url`,
      { method: 'POST' },
    )
  }

  async function recordDocument(
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
    documents.value[merchantId] = [...(documents.value[merchantId] ?? []), body.document]
    return body.document
  }

  async function uploadDocument(
    merchantId: string,
    file: File,
    documentType: string,
  ): Promise<MerchantDocument> {
    const { uploadUrl, objectName } = await getUploadUrl(merchantId)
    const putRes = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
    })
    if (!putRes.ok) throw new Error('upload_failed')
    return recordDocument(merchantId, { fileUrl: objectName, documentType })
  }

  async function fetchMerchantTariffs(merchantId: string): Promise<void> {
    const body = await api<{ tariffs: Tariff[] }>(`/admin/merchants/${merchantId}/tariffs`)
    merchantTariffs.value[merchantId] = body.tariffs
  }

  async function assignTariff(merchantId: string, tariffId: string): Promise<void> {
    await api(`/admin/merchants/${merchantId}/tariffs/${tariffId}`, { method: 'POST' })
    const t = merchantTariffs.value[merchantId]?.find((x) => x.id === tariffId)
    if (t) t.selected = true
  }

  async function removeTariff(merchantId: string, tariffId: string): Promise<void> {
    await api(`/admin/merchants/${merchantId}/tariffs/${tariffId}`, { method: 'DELETE' })
    const t = merchantTariffs.value[merchantId]?.find((x) => x.id === tariffId)
    if (t) t.selected = false
  }

  async function fetchBankList(): Promise<void> {
    if (bankList.value.length > 0) return
    const body = await api<{ banks: BankEntry[] }>('/admin/banks')
    bankList.value = body.banks
  }

  async function refreshBankList(): Promise<void> {
    const body = await api<{ banks: BankEntry[] }>('/admin/banks/refresh', { method: 'POST' })
    bankList.value = body.banks
  }

  return {
    merchants,
    branches,
    employees,
    categories,
    products,
    documents,
    merchantTariffs,
    bankList,
    loading,
    error,
    byId,
    branchesFor,
    employeesForBranch,
    categoriesFor,
    productsFor,
    documentsFor,
    tariffsFor,
    fetchAll,
    fetchOne,
    create,
    update,
    fetchBranches,
    createBranch,
    updateBranch,
    fetchEmployees,
    createEmployee,
    updateEmployee,
    changeEmployeePassword,
    globalCategories,
    fetchGlobalCategories,
    fetchCategories,
    enableCategory,
    disableCategory,
    fetchProducts,
    createProduct,
    updateProduct,
    fetchDocuments,
    getUploadUrl,
    recordDocument,
    uploadDocument,
    fetchMerchantTariffs,
    assignTariff,
    removeTariff,
    fetchBankList,
    refreshBankList,
  }
})
