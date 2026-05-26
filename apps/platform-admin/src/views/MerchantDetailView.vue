<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import MultiSelect from 'primevue/multiselect'
import ToggleSwitch from 'primevue/toggleswitch'
import Tag from 'primevue/tag'
import { useToast } from 'primevue/usetoast'
import { useMerchantsStore } from '@/stores/merchants'
import { formatDateTime } from '@/utils/money'
import type { Branch, Category, MerchantEmployee, Product } from '@/types'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const toast = useToast()
const merchants = useMerchantsStore()

const merchantId = computed(() => route.params.id as string)
const merchant = computed(() => merchants.byId(merchantId.value))

const tabs = ['Branches', 'Employees', 'Products', 'Categories', 'Documents'] as const
type Tab = (typeof tabs)[number]
const activeTab = ref<Tab>('Branches')

const TAB_LABEL_KEYS: Record<Tab, string> = {
  Branches: 'merchantDetail.tabBranches',
  Employees: 'merchantDetail.tabEmployees',
  Products: 'merchantDetail.tabProducts',
  Categories: 'merchantDetail.tabCategories',
  Documents: 'merchantDetail.tabDocuments',
}

function tabLabel(tab: Tab): string {
  return t(TAB_LABEL_KEYS[tab])
}

const ROLE_OPTIONS = ['agent', 'branch_admin', 'merchant_admin']

const branches = computed(() => merchants.branchesFor(merchantId.value))
const categories = computed(() => merchants.categoriesFor(merchantId.value))
const products = computed(() => merchants.productsFor(merchantId.value))
const documents = computed(() => merchants.documentsFor(merchantId.value))

// All employees across this merchant's branches, flattened.
const allEmployees = computed<MerchantEmployee[]>(() =>
  branches.value.flatMap((b) => merchants.employeesForBranch(b.id)),
)

function branchName(id: string): string {
  return branches.value.find((b) => b.id === id)?.name ?? '—'
}

function categoryName(id: string): string {
  return categories.value.find((c) => c.id === id)?.name ?? '—'
}

function notifyError(key: string) {
  toast.add({ severity: 'error', summary: t(key), life: 3000 })
}

async function loadEmployeesForBranches() {
  await Promise.all(branches.value.map((b) => merchants.fetchEmployees(b.id)))
}

onMounted(async () => {
  try {
    await merchants.fetchOne(merchantId.value)
    await merchants.fetchBranches(merchantId.value)
    await Promise.all([
      loadEmployeesForBranches(),
      merchants.fetchCategories(merchantId.value),
      merchants.fetchProducts(merchantId.value),
      merchants.fetchDocuments(merchantId.value),
    ])
  } catch {
    notifyError('merchantDetail.loadFailed')
  }
})

async function toggleMerchant() {
  if (!merchant.value) return
  const was = merchant.value.active
  try {
    await merchants.update(merchant.value.id, { active: !was })
    toast.add({
      severity: was ? 'warn' : 'success',
      summary: was ? t('merchantDetail.merchantSuspended') : t('merchantDetail.merchantActivated'),
      detail: merchant.value.name,
      life: 2000,
    })
  } catch {
    notifyError('merchantDetail.updateFailed')
  }
}

// --- Branches ----------------------------------------------------------------
const showBranch = ref(false)
const branchForm = ref({ name: '', address: '', phone: '' })
const branchSaving = ref(false)

function openBranch() {
  branchForm.value = { name: '', address: '', phone: '' }
  showBranch.value = true
}

async function submitBranch() {
  if (!branchForm.value.name || !branchForm.value.address || !branchForm.value.phone) return
  branchSaving.value = true
  try {
    await merchants.createBranch(merchantId.value, { ...branchForm.value })
    toast.add({ severity: 'success', summary: t('merchantDetail.branchCreated'), life: 2000 })
    showBranch.value = false
  } catch {
    notifyError('merchantDetail.createFailed')
  } finally {
    branchSaving.value = false
  }
}

async function toggleBranch(branch: Branch) {
  try {
    await merchants.updateBranch(branch.id, { active: !branch.active })
  } catch {
    notifyError('merchantDetail.updateFailed')
  }
}

function branchEmployeeCount(branchId: string): number {
  return merchants.employeesForBranch(branchId).length
}

// --- Employees ---------------------------------------------------------------
const showEmployee = ref(false)
const employeeForm = ref<{
  email: string
  password: string
  fullName: string
  branchId: string | null
  roles: string[]
}>({ email: '', password: '', fullName: '', branchId: null, roles: [] })
const employeeSaving = ref(false)

function openEmployee() {
  employeeForm.value = { email: '', password: '', fullName: '', branchId: null, roles: [] }
  showEmployee.value = true
}

async function submitEmployee() {
  const f = employeeForm.value
  if (!f.email || f.password.length < 8 || !f.fullName || !f.branchId || f.roles.length === 0) return
  employeeSaving.value = true
  try {
    await merchants.createEmployee(f.branchId, {
      email: f.email,
      password: f.password,
      fullName: f.fullName,
      roles: f.roles,
    })
    toast.add({ severity: 'success', summary: t('merchantDetail.employeeCreated'), life: 2000 })
    showEmployee.value = false
  } catch {
    notifyError('merchantDetail.createFailed')
  } finally {
    employeeSaving.value = false
  }
}

async function toggleEmployee(employee: MerchantEmployee) {
  try {
    await merchants.updateEmployee(employee.id, { active: !employee.active })
  } catch {
    notifyError('merchantDetail.updateFailed')
  }
}

// --- Categories --------------------------------------------------------------
const showCategory = ref(false)
const categoryForm = ref({ name: '' })
const categorySaving = ref(false)

function openCategory() {
  categoryForm.value = { name: '' }
  showCategory.value = true
}

async function submitCategory() {
  if (!categoryForm.value.name) return
  categorySaving.value = true
  try {
    await merchants.createCategory(merchantId.value, { ...categoryForm.value })
    toast.add({ severity: 'success', summary: t('merchantDetail.categoryCreated'), life: 2000 })
    showCategory.value = false
  } catch {
    notifyError('merchantDetail.createFailed')
  } finally {
    categorySaving.value = false
  }
}

async function toggleCategory(category: Category) {
  try {
    await merchants.updateCategory(category.id, { active: !category.active })
  } catch {
    notifyError('merchantDetail.updateFailed')
  }
}

// --- Products ----------------------------------------------------------------
const showProduct = ref(false)
const productForm = ref<{
  categoryId: string | null
  name: string
  tanNarxi: number | null
  mxikCode: string
  packageCode: number | null
  packageName: string
}>({ categoryId: null, name: '', tanNarxi: null, mxikCode: '', packageCode: null, packageName: '' })
const productSaving = ref(false)

function openProduct() {
  productForm.value = { categoryId: null, name: '', tanNarxi: null, mxikCode: '', packageCode: null, packageName: '' }
  mxikData.value = null
  mxikSuggestions.value = []
  showProduct.value = true
}

async function submitProduct() {
  const f = productForm.value
  if (!f.categoryId || !f.name || f.tanNarxi === null) return
  productSaving.value = true
  try {
    await merchants.createProduct(merchantId.value, {
      categoryId: f.categoryId,
      name: f.name,
      tanNarxi: String(f.tanNarxi),
      mxikCode: f.mxikCode || undefined,
      packageCode: f.packageCode ?? undefined,
      packageName: f.packageName || undefined,
    })
    toast.add({ severity: 'success', summary: t('merchantDetail.productCreated'), life: 2000 })
    showProduct.value = false
  } catch {
    notifyError('merchantDetail.createFailed')
  } finally {
    productSaving.value = false
  }
}

// --- MXIK combobox -----------------------------------------------------------
const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

interface MxikPackage { code: number; name: string }
interface MxikEntry {
  mxikCode: string
  mxikName: string | null
  label: number
  packages: MxikPackage[] | null
}

const mxikSuggestions = ref<MxikEntry[]>([])
const mxikSearchLoading = ref(false)
const mxikLookupLoading = ref(false)
const mxikData = ref<MxikEntry | null>(null)
let mxikSearchTimer = 0

async function apiFetchMxik<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { credentials: 'include' })
  if (!res.ok) throw new Error(`http_${res.status}`)
  return res.json()
}

async function searchMxikSuggestions(q: string) {
  mxikSuggestions.value = []
  if (!q || q.length < 2) return
  mxikSearchLoading.value = true
  try {
    const { results } = await apiFetchMxik<{ results: MxikEntry[] }>(`/admin/mxik/search?q=${encodeURIComponent(q)}`)
    mxikSuggestions.value = results
  } catch { /* silent */ } finally {
    mxikSearchLoading.value = false
  }
}

async function triggerMxikLookup() {
  const code = productForm.value.mxikCode.trim()
  if (code.length !== 17) return
  mxikLookupLoading.value = true
  mxikData.value = null
  productForm.value.packageCode = null
  productForm.value.packageName = ''
  try {
    const { mxik } = await apiFetchMxik<{ mxik: MxikEntry }>(`/admin/mxik/lookup?code=${encodeURIComponent(code)}`)
    mxikData.value = mxik
  } catch {
    toast.add({ severity: 'warn', summary: t('merchantDetail.mxikNotFound'), life: 2500 })
  } finally {
    mxikLookupLoading.value = false
  }
}

function onMxikInputAdmin(e: Event) {
  const val = (e.target as HTMLInputElement).value
  clearTimeout(mxikSearchTimer)
  if (val.length === 17) {
    mxikSuggestions.value = []
    triggerMxikLookup()
  } else {
    mxikSearchTimer = window.setTimeout(() => searchMxikSuggestions(val), 300)
  }
}

function selectMxikSuggestionAdmin(item: MxikEntry) {
  productForm.value.mxikCode = item.mxikCode
  mxikSuggestions.value = []
  triggerMxikLookup()
}

function onPackageSelectAdmin(code: number) {
  const pkg = mxikData.value?.packages?.find((p) => p.code === code)
  if (pkg) {
    productForm.value.packageCode = pkg.code
    productForm.value.packageName = pkg.name
  }
}

function resetMxikAdmin() {
  mxikData.value = null
  mxikSuggestions.value = []
  productForm.value.packageCode = null
  productForm.value.packageName = ''
}

async function toggleProduct(product: Product) {
  try {
    await merchants.updateProduct(product.id, { active: !product.active })
  } catch {
    notifyError('merchantDetail.updateFailed')
  }
}

function formatTanNarxi(value: string): string {
  const n = Number(value)
  return Number.isFinite(n) ? n.toLocaleString('en-US') : value
}

// --- Documents ---------------------------------------------------------------
const showDocument = ref(false)
const documentType = ref('')
const documentFile = ref<File | null>(null)
const documentUploading = ref(false)

function openDocument() {
  documentType.value = ''
  documentFile.value = null
  showDocument.value = true
}

function onFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  documentFile.value = target.files?.[0] ?? null
}

async function submitDocument() {
  if (!documentFile.value || !documentType.value) return
  documentUploading.value = true
  try {
    const { uploadUrl, objectName } = await merchants.getUploadUrl(merchantId.value)
    const putRes = await fetch(uploadUrl, {
      method: 'PUT',
      body: documentFile.value,
      headers: { 'Content-Type': documentFile.value.type || 'application/octet-stream' },
    })
    if (!putRes.ok) throw new Error('upload_failed')
    await merchants.recordDocument(merchantId.value, {
      fileUrl: objectName,
      documentType: documentType.value,
    })
    toast.add({ severity: 'success', summary: t('merchantDetail.documentUploaded'), life: 2000 })
    showDocument.value = false
  } catch {
    notifyError('merchantDetail.uploadFailed')
  } finally {
    documentUploading.value = false
  }
}

function truncate(value: string, max = 48): string {
  return value.length > max ? value.slice(0, max) + '…' : value
}
</script>

<template>
  <div v-if="merchant" class="detail">
    <button class="back" @click="router.push('/merchants')">
      <i class="pi pi-arrow-left" /> {{ $t('merchantDetail.backToMerchants') }}
    </button>

    <header class="t-header surface-card">
      <div class="t-id">
        <div class="t-avatar">{{ merchant.name.charAt(0) }}</div>
        <div>
          <h2 class="t-name">{{ merchant.name }}</h2>
          <span class="t-slug font-mono">
            {{ $t('merchantDetail.inn') }}: {{ merchant.inn }} · {{ merchant.phone }}
          </span>
        </div>
        <span
          class="t-status"
          :style="{
            color: merchant.active ? 'var(--success)' : 'var(--danger)',
            background: merchant.active ? 'var(--success-bg)' : 'var(--danger-bg)',
          }"
        >
          {{ merchant.active ? $t('merchantDetail.active') : $t('merchantDetail.suspended') }}
        </span>
      </div>
      <button
        :class="merchant.active ? 'btn-ghost' : 'btn-gradient'"
        @click="toggleMerchant"
      >
        <i :class="merchant.active ? 'pi pi-ban' : 'pi pi-check'" />
        {{ merchant.active ? $t('merchantDetail.suspend') : $t('merchantDetail.activate') }}
      </button>
    </header>

    <nav class="tabs">
      <button
        v-for="tab in tabs"
        :key="tab"
        class="tab"
        :class="{ active: activeTab === tab }"
        @click="activeTab = tab"
      >
        {{ tabLabel(tab) }}
      </button>
    </nav>

    <!-- Branches -->
    <section v-if="activeTab === 'Branches'" class="tab-body">
      <div class="tab-head">
        <h3 class="section-title">{{ $t('merchantDetail.branches') }}</h3>
        <button class="btn-gradient" @click="openBranch">
          <i class="pi pi-plus" /> {{ $t('merchantDetail.addBranch') }}
        </button>
      </div>
      <div class="surface-card table-wrap">
        <DataTable :value="branches" data-key="id" size="small">
          <Column :header="$t('merchantDetail.name')">
            <template #body="{ data }">
              <span class="t-name-sm">{{ data.name }}</span>
            </template>
          </Column>
          <Column :header="$t('merchantDetail.address')">
            <template #body="{ data }">{{ data.address }}</template>
          </Column>
          <Column :header="$t('merchantDetail.phone')">
            <template #body="{ data }">
              <span class="font-mono muted">{{ data.phone }}</span>
            </template>
          </Column>
          <Column :header="$t('merchantDetail.employeesCount')">
            <template #body="{ data }">
              <span class="font-mono">{{ branchEmployeeCount(data.id) }}</span>
            </template>
          </Column>
          <Column :header="$t('merchantDetail.active')">
            <template #body="{ data }">
              <ToggleSwitch :model-value="data.active" @update:model-value="toggleBranch(data)" />
            </template>
          </Column>
        </DataTable>
      </div>
    </section>

    <!-- Employees -->
    <section v-else-if="activeTab === 'Employees'" class="tab-body">
      <div class="tab-head">
        <h3 class="section-title">{{ $t('merchantDetail.employees') }}</h3>
        <button class="btn-gradient" :disabled="branches.length === 0" @click="openEmployee">
          <i class="pi pi-plus" /> {{ $t('merchantDetail.addEmployee') }}
        </button>
      </div>
      <div class="surface-card table-wrap">
        <DataTable :value="allEmployees" data-key="id" size="small">
          <Column :header="$t('merchantDetail.name')">
            <template #body="{ data }">
              <span class="t-name-sm">{{ data.fullName }}</span>
            </template>
          </Column>
          <Column :header="$t('merchantDetail.email')">
            <template #body="{ data }">
              <span class="font-mono muted">{{ data.email }}</span>
            </template>
          </Column>
          <Column :header="$t('merchantDetail.branch')">
            <template #body="{ data }">{{ branchName(data.branchId) }}</template>
          </Column>
          <Column :header="$t('merchantDetail.roles')">
            <template #body="{ data }">
              <span v-for="r in data.roles" :key="r" class="chip">{{ r }}</span>
            </template>
          </Column>
          <Column :header="$t('merchantDetail.mustChangePwd')">
            <template #body="{ data }">
              <Tag
                v-if="data.mustChangePassword"
                :value="$t('merchantDetail.yes')"
                severity="warn"
              />
              <span v-else class="muted">—</span>
            </template>
          </Column>
          <Column :header="$t('merchantDetail.active')">
            <template #body="{ data }">
              <ToggleSwitch
                :model-value="data.active"
                @update:model-value="toggleEmployee(data)"
              />
            </template>
          </Column>
        </DataTable>
      </div>
    </section>

    <!-- Products -->
    <section v-else-if="activeTab === 'Products'" class="tab-body">
      <div class="tab-head">
        <h3 class="section-title">{{ $t('merchantDetail.products') }}</h3>
        <button class="btn-gradient" :disabled="categories.length === 0" @click="openProduct">
          <i class="pi pi-plus" /> {{ $t('merchantDetail.addProduct') }}
        </button>
      </div>
      <div class="surface-card table-wrap">
        <DataTable :value="products" data-key="id" size="small">
          <Column :header="$t('merchantDetail.name')">
            <template #body="{ data }">
              <span class="t-name-sm">{{ data.name }}</span>
            </template>
          </Column>
          <Column :header="$t('merchantDetail.category')">
            <template #body="{ data }">{{ categoryName(data.categoryId) }}</template>
          </Column>
          <Column :header="$t('merchantDetail.tanNarxi')">
            <template #body="{ data }">
              <span class="font-mono">{{ formatTanNarxi(data.tanNarxi) }}</span>
            </template>
          </Column>
          <Column :header="$t('merchantDetail.mxikCode')">
            <template #body="{ data }">
              <span class="font-mono muted">{{ data.mxikCode || '—' }}</span>
            </template>
          </Column>
          <Column :header="$t('merchantDetail.active')">
            <template #body="{ data }">
              <ToggleSwitch
                :model-value="data.active"
                @update:model-value="toggleProduct(data)"
              />
            </template>
          </Column>
        </DataTable>
      </div>
    </section>

    <!-- Categories -->
    <section v-else-if="activeTab === 'Categories'" class="tab-body">
      <div class="tab-head">
        <h3 class="section-title">{{ $t('merchantDetail.categories') }}</h3>
        <button class="btn-gradient" @click="openCategory">
          <i class="pi pi-plus" /> {{ $t('merchantDetail.addCategory') }}
        </button>
      </div>
      <div class="surface-card table-wrap">
        <DataTable :value="categories" data-key="id" size="small">
          <Column :header="$t('merchantDetail.name')">
            <template #body="{ data }">
              <span class="t-name-sm">{{ data.name }}</span>
            </template>
          </Column>
          <Column :header="$t('merchantDetail.active')">
            <template #body="{ data }">
              <ToggleSwitch
                :model-value="data.active"
                @update:model-value="toggleCategory(data)"
              />
            </template>
          </Column>
        </DataTable>
      </div>
    </section>

    <!-- Documents -->
    <section v-else class="tab-body">
      <div class="tab-head">
        <h3 class="section-title">{{ $t('merchantDetail.documents') }}</h3>
        <button class="btn-gradient" @click="openDocument">
          <i class="pi pi-upload" /> {{ $t('merchantDetail.uploadDocument') }}
        </button>
      </div>
      <div class="surface-card table-wrap">
        <DataTable :value="documents" data-key="id" size="small">
          <Column :header="$t('merchantDetail.documentType')">
            <template #body="{ data }">
              <span class="t-name-sm">{{ data.documentType }}</span>
            </template>
          </Column>
          <Column :header="$t('merchantDetail.url')">
            <template #body="{ data }">
              <a class="doc-link font-mono" :href="data.fileUrl" target="_blank" rel="noopener">
                {{ truncate(data.fileUrl) }}
              </a>
            </template>
          </Column>
          <Column :header="$t('merchantDetail.uploadedAt')">
            <template #body="{ data }">
              <span class="font-mono muted">{{ formatDateTime(data.uploadedAt) }}</span>
            </template>
          </Column>
        </DataTable>
      </div>
    </section>

    <!-- Branch dialog -->
    <Dialog
      v-model:visible="showBranch"
      modal
      :header="$t('merchantDetail.addBranch')"
      :style="{ width: '440px' }"
    >
      <div class="field">
        <label class="field-label">{{ $t('merchantDetail.name') }}</label>
        <InputText v-model="branchForm.name" />
      </div>
      <div class="field">
        <label class="field-label">{{ $t('merchantDetail.address') }}</label>
        <InputText v-model="branchForm.address" />
      </div>
      <div class="field">
        <label class="field-label">{{ $t('merchantDetail.phone') }}</label>
        <InputText v-model="branchForm.phone" />
      </div>
      <template #footer>
        <button class="btn-ghost" @click="showBranch = false">{{ $t('common.cancel') }}</button>
        <button class="btn-gradient" :disabled="branchSaving" @click="submitBranch">
          {{ $t('merchantDetail.create') }}
        </button>
      </template>
    </Dialog>

    <!-- Employee dialog -->
    <Dialog
      v-model:visible="showEmployee"
      modal
      :header="$t('merchantDetail.addEmployee')"
      :style="{ width: '460px' }"
    >
      <div class="field">
        <label class="field-label">{{ $t('merchantDetail.fullName') }}</label>
        <InputText v-model="employeeForm.fullName" />
      </div>
      <div class="field">
        <label class="field-label">{{ $t('merchantDetail.email') }}</label>
        <InputText v-model="employeeForm.email" />
      </div>
      <div class="field">
        <label class="field-label">{{ $t('merchantDetail.password') }}</label>
        <InputText v-model="employeeForm.password" type="password" />
        <span class="field-hint muted">{{ $t('merchantDetail.passwordHint') }}</span>
      </div>
      <div class="field">
        <label class="field-label">{{ $t('merchantDetail.branch') }}</label>
        <Select
          v-model="employeeForm.branchId"
          :options="branches"
          option-label="name"
          option-value="id"
          :placeholder="$t('merchantDetail.selectBranch')"
        />
      </div>
      <div class="field">
        <label class="field-label">{{ $t('merchantDetail.roles') }}</label>
        <MultiSelect
          v-model="employeeForm.roles"
          :options="ROLE_OPTIONS"
          :placeholder="$t('merchantDetail.selectRoles')"
          display="chip"
        />
      </div>
      <template #footer>
        <button class="btn-ghost" @click="showEmployee = false">{{ $t('common.cancel') }}</button>
        <button class="btn-gradient" :disabled="employeeSaving" @click="submitEmployee">
          {{ $t('merchantDetail.create') }}
        </button>
      </template>
    </Dialog>

    <!-- Category dialog -->
    <Dialog
      v-model:visible="showCategory"
      modal
      :header="$t('merchantDetail.addCategory')"
      :style="{ width: '420px' }"
    >
      <div class="field">
        <label class="field-label">{{ $t('merchantDetail.name') }}</label>
        <InputText v-model="categoryForm.name" />
      </div>
      <template #footer>
        <button class="btn-ghost" @click="showCategory = false">{{ $t('common.cancel') }}</button>
        <button class="btn-gradient" :disabled="categorySaving" @click="submitCategory">
          {{ $t('merchantDetail.create') }}
        </button>
      </template>
    </Dialog>

    <!-- Product dialog -->
    <Dialog
      v-model:visible="showProduct"
      modal
      :header="$t('merchantDetail.addProduct')"
      :style="{ width: '460px' }"
    >
      <div class="field">
        <label class="field-label">{{ $t('merchantDetail.name') }}</label>
        <InputText v-model="productForm.name" />
      </div>
      <div class="field">
        <label class="field-label">{{ $t('merchantDetail.category') }}</label>
        <Select
          v-model="productForm.categoryId"
          :options="categories"
          option-label="name"
          option-value="id"
          :placeholder="$t('merchantDetail.selectCategory')"
        />
      </div>
      <div class="field">
        <label class="field-label">{{ $t('merchantDetail.tanNarxi') }}</label>
        <InputNumber v-model="productForm.tanNarxi" :min="0" :use-grouping="true" fluid />
      </div>
      <div class="field">
        <label class="field-label">
          {{ $t('merchantDetail.mxikCode') }} <span class="muted">({{ $t('merchantDetail.optional') }})</span>
        </label>
        <div class="mxik-wrap">
          <div class="mxik-input-row">
            <InputText
              v-model="productForm.mxikCode"
              class="font-mono mxik-input"
              :placeholder="$t('merchantDetail.mxikPlaceholder')"
              @input="onMxikInputAdmin"
              @blur="() => setTimeout(() => { mxikSuggestions = [] }, 200)"
              @keydown.enter.prevent="triggerMxikLookup"
            />
            <button
              v-if="productForm.mxikCode && !mxikLookupLoading"
              class="mxik-search-btn"
              type="button"
              @click="triggerMxikLookup"
            >
              <i class="pi pi-search" />
            </button>
            <span v-if="mxikLookupLoading || mxikSearchLoading" class="mxik-spinner">
              <i class="pi pi-spin pi-spinner" />
            </span>
          </div>

          <ul v-if="mxikSuggestions.length" class="mxik-suggestions">
            <li
              v-for="s in mxikSuggestions"
              :key="s.mxikCode"
              class="mxik-suggestion-item"
              @mousedown.prevent="selectMxikSuggestionAdmin(s)"
            >
              <span class="sug-code">{{ s.mxikCode }}</span>
              <span class="sug-name">{{ s.mxikName }}</span>
            </li>
          </ul>

          <div v-if="mxikData" class="mxik-result">
            <div class="mxik-result-header">
              <span class="mxik-result-name">{{ mxikData.mxikName }}</span>
              <span v-if="mxikData.label" class="mxik-label-badge">{{ $t('merchantDetail.mxikLabeled') }}</span>
              <button class="mxik-clear-btn" type="button" @click="resetMxikAdmin">
                <i class="pi pi-times" />
              </button>
            </div>
            <div v-if="mxikData.packages?.length" class="field" style="margin-top: 0.75rem; margin-bottom: 0">
              <label class="field-label">{{ $t('merchantDetail.packageCode') }}</label>
              <Select
                :model-value="productForm.packageCode"
                :options="mxikData.packages"
                option-label="name"
                option-value="code"
                :placeholder="$t('merchantDetail.selectPackage')"
                @update:model-value="onPackageSelectAdmin"
              />
            </div>
          </div>

          <p v-if="!mxikData && productForm.mxikCode && productForm.mxikCode.length < 17" class="mxik-hint">
            {{ $t('merchantDetail.mxikHint') }}
          </p>
        </div>
      </div>
      <template #footer>
        <button class="btn-ghost" @click="showProduct = false">{{ $t('common.cancel') }}</button>
        <button class="btn-gradient" :disabled="productSaving" @click="submitProduct">
          {{ $t('merchantDetail.create') }}
        </button>
      </template>
    </Dialog>

    <!-- Document dialog -->
    <Dialog
      v-model:visible="showDocument"
      modal
      :header="$t('merchantDetail.uploadDocument')"
      :style="{ width: '460px' }"
    >
      <div class="field">
        <label class="field-label">{{ $t('merchantDetail.documentType') }}</label>
        <InputText v-model="documentType" placeholder="contract, license, …" />
      </div>
      <div class="field">
        <label class="field-label">{{ $t('merchantDetail.file') }}</label>
        <input class="file-input" type="file" @change="onFileChange" />
      </div>
      <template #footer>
        <button class="btn-ghost" @click="showDocument = false">{{ $t('common.cancel') }}</button>
        <button
          class="btn-gradient"
          :disabled="documentUploading || !documentFile || !documentType"
          @click="submitDocument"
        >
          {{ documentUploading ? $t('merchantDetail.uploading') : $t('merchantDetail.upload') }}
        </button>
      </template>
    </Dialog>
  </div>

  <div v-else class="not-found surface-card">
    <i class="pi pi-exclamation-circle" />
    <p>{{ $t('merchantDetail.notFound') }}</p>
    <button class="btn-ghost" @click="router.push('/merchants')">
      {{ $t('merchantDetail.backToMerchants') }}
    </button>
  </div>
</template>

<style scoped>
.detail {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}
.back {
  align-self: flex-start;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-weight: 600;
  font-size: 0.82rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-family: inherit;
}
.back:hover {
  color: var(--accent-2);
}
.t-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.2rem;
}
.t-id {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}
.t-avatar {
  width: 42px;
  height: 42px;
  border-radius: 11px;
  background: var(--gradient-hero);
  color: #fff;
  font-weight: 800;
  display: grid;
  place-items: center;
  font-size: 1.05rem;
}
.t-name {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 800;
}
.t-slug {
  font-size: 0.76rem;
  color: var(--text-secondary);
}
.t-status {
  margin-left: 0.5rem;
  padding: 0.25rem 0.65rem;
  border-radius: 999px;
  font-size: 0.74rem;
  font-weight: 700;
}

.tabs {
  display: flex;
  gap: 0.3rem;
  border-bottom: 1px solid var(--border-subtle);
}
.tab {
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  padding: 0.6rem 0.9rem;
  font-family: inherit;
  font-size: 0.84rem;
  font-weight: 700;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.12s ease;
}
.tab:hover {
  color: var(--text-primary);
}
.tab.active {
  color: var(--accent-2);
  border-bottom-color: var(--accent-2);
}

.tab-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.tab-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.section-title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 800;
}

.table-wrap {
  padding: 0;
  overflow: hidden;
}
.t-name-sm {
  font-weight: 700;
  font-size: 0.85rem;
}
.chip {
  display: inline-block;
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--accent-2);
  background: color-mix(in srgb, var(--accent-2) 12%, transparent);
  padding: 0.12rem 0.5rem;
  border-radius: 999px;
  margin-right: 0.3rem;
}
.doc-link {
  color: var(--accent-2);
  font-size: 0.8rem;
  text-decoration: none;
}
.doc-link:hover {
  text-decoration: underline;
}

.field {
  margin-bottom: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.field-hint {
  font-size: 0.72rem;
}
.file-input {
  font-family: inherit;
  font-size: 0.82rem;
  color: var(--text-secondary);
}

.not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.8rem;
  padding: 3rem;
  text-align: center;
}
.not-found i {
  font-size: 2rem;
  color: var(--danger);
}

/* MXIK combobox */
.mxik-wrap { position: relative; display: flex; flex-direction: column; gap: 0; }
.mxik-input-row { display: flex; align-items: center; gap: 0.5rem; }
.mxik-input { flex: 1; }
.mxik-search-btn {
  flex-shrink: 0; width: 36px; height: 36px; border-radius: 8px;
  border: 1px solid var(--border-subtle); background: var(--bg-surface);
  color: var(--text-secondary); cursor: pointer; display: grid; place-items: center;
  transition: all 0.15s ease;
}
.mxik-search-btn:hover { color: var(--accent-2); border-color: var(--accent-2); }
.mxik-spinner { color: var(--text-secondary); font-size: 1rem; }
.mxik-suggestions {
  position: absolute; top: 38px; left: 0; right: 0;
  background: var(--bg-card, #fff); border: 1px solid var(--border-subtle);
  border-radius: 6px; box-shadow: 0 4px 16px rgba(0,0,0,.08);
  z-index: 100; max-height: 220px; overflow-y: auto;
  list-style: none; margin: 4px 0 0; padding: 4px 0;
}
.mxik-suggestion-item { display: flex; flex-direction: column; gap: 2px; padding: 8px 12px; cursor: pointer; }
.mxik-suggestion-item:hover { background: var(--bg-surface); }
.sug-code { font-family: monospace; font-size: 11px; color: var(--text-secondary); }
.sug-name { font-size: 13px; color: var(--text-primary); }
.mxik-result {
  margin-top: 0.5rem; padding: 0.75rem;
  border: 1px solid var(--border-subtle); border-radius: 8px; background: var(--bg-surface);
}
.mxik-result-header { display: flex; align-items: center; gap: 0.5rem; }
.mxik-result-name { font-size: 0.85rem; font-weight: 600; flex: 1; }
.mxik-label-badge {
  font-size: 0.7rem; font-weight: 700; padding: 2px 8px;
  border-radius: 20px; background: var(--accent-2); color: #fff;
}
.mxik-clear-btn {
  width: 24px; height: 24px; border-radius: 4px; border: none;
  background: transparent; color: var(--text-secondary);
  cursor: pointer; display: grid; place-items: center; font-size: 0.75rem;
}
.mxik-clear-btn:hover { color: var(--danger); }
.mxik-hint { font-size: 0.75rem; color: var(--text-secondary); margin: 4px 0 0; }
</style>
