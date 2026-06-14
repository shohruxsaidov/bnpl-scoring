<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import InputMask from 'primevue/inputmask'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import MultiSelect from 'primevue/multiselect'
import RadioButton from 'primevue/radiobutton'
import ToggleSwitch from 'primevue/toggleswitch'
import Tag from 'primevue/tag'
import { useToast } from 'primevue/usetoast'
import { useAuthStore } from '@/stores/auth'
import { useMerchantsStore } from '@/stores/merchants'
import { useScoringModelStore, type ScoringModelListItem } from '@/stores/scoring-model'
import { useMxik, type MxikEntry, type MxikPackage } from '@/composables/use-mxik'
import { useRegions } from '@/composables/use-regions'
import { formatDateTime } from '@/utils/money'
import type { Branch, Category, MerchantEmployee, Product } from '@/types'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const toast = useToast()
const auth = useAuthStore()
const merchants = useMerchantsStore()
const scoringModels = useScoringModelStore()

const merchantId = computed(() => route.params.id as string)
const merchant = computed(() => merchants.byId(merchantId.value))

const allTabs = ['Branches', 'Employees', 'Products', 'Categories', 'Documents', 'Tariffs', 'ScoringModel'] as const
type Tab = (typeof allTabs)[number]

// The models list endpoint is permission-gated; hide the tab like the sidebar does.
const tabs = computed<readonly Tab[]>(() =>
  auth.can('manage_scoring_model') ? allTabs : allTabs.filter((t) => t !== 'ScoringModel'),
)

function tabFromQuery(): Tab {
  const q = (route.query.tab as string)?.toLowerCase()
  return tabs.value.find((t) => t.toLowerCase() === q) ?? 'Branches'
}
const activeTab = ref<Tab>(tabFromQuery())

const TAB_LABEL_KEYS: Record<Tab, string> = {
  Branches: 'merchantDetail.tabBranches',
  Employees: 'merchantDetail.tabEmployees',
  Products: 'merchantDetail.tabProducts',
  Categories: 'merchantDetail.tabCategories',
  Documents: 'merchantDetail.tabDocuments',
  Tariffs: 'merchantDetail.tabTariffs',
  ScoringModel: 'merchantDetail.tabScoringModel',
}

function tabLabel(tab: Tab): string {
  return t(TAB_LABEL_KEYS[tab])
}

const ROLE_OPTIONS = ['agent', 'merchant_admin']

const branches = computed(() => merchants.branchesFor(merchantId.value))
const categories = computed(() => merchants.categoriesFor(merchantId.value))
const products = computed(() => merchants.productsFor(merchantId.value))
const documents = computed(() => merchants.documentsFor(merchantId.value))
const merchantTariffs = computed(() => merchants.tariffsFor(merchantId.value))

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
      merchants.fetchMerchantTariffs(merchantId.value),
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
const branchForm = ref({ name: '', address: '', phone: '', regionId: null as number | null })
const branchRegion = ref<number | null>(null)
const branchSaving = ref(false)

const { regionOptions, districtOptions, onRegionChange, lookupName, lookupParent } = useRegions()

function openBranch() {
  branchForm.value = { name: '', address: '', phone: '', regionId: null }
  branchRegion.value = null
  showBranch.value = true
}

async function submitBranch() {
  if (!branchForm.value.name || !branchForm.value.address || !branchForm.value.phone) return
  branchSaving.value = true
  try {
    await merchants.createBranch(merchantId.value, {
      name: branchForm.value.name,
      address: branchForm.value.address,
      phone: branchForm.value.phone,
      regionId: branchForm.value.regionId ?? undefined,
    })
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
  phone: string
  password: string
  fullName: string
  branchId: string | null
  roles: string[]
}>({ phone: '', password: '', fullName: '', branchId: null, roles: [] })
const employeeSaving = ref(false)

function openEmployee() {
  employeeForm.value = { phone: '', password: '', fullName: '', branchId: null, roles: [] }
  showEmployee.value = true
}

async function submitEmployee() {
  const f = employeeForm.value
  if (!f.phone || f.phone.includes('_') || f.password.length < 8 || !f.fullName || !f.branchId || f.roles.length === 0) return
  employeeSaving.value = true
  try {
    await merchants.createEmployee(f.branchId, {
      phone: '998' + f.phone.replace(/\D/g, ''),
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

// --- Change employee password ------------------------------------------------
const showChangePwd = ref(false)
const changePwdEmployeeId = ref('')
const changePwdValue = ref('')
const changePwdSaving = ref(false)

function openChangePwd(employee: MerchantEmployee) {
  changePwdEmployeeId.value = employee.id
  changePwdValue.value = ''
  showChangePwd.value = true
}

async function submitChangePwd() {
  if (changePwdValue.value.length < 8) return
  changePwdSaving.value = true
  try {
    await merchants.changeEmployeePassword(changePwdEmployeeId.value, changePwdValue.value)
    toast.add({ severity: 'success', summary: t('merchantDetail.passwordChanged'), life: 2000 })
    showChangePwd.value = false
  } catch {
    notifyError('merchantDetail.changePasswordFailed')
  } finally {
    changePwdSaving.value = false
  }
}

// --- Categories --------------------------------------------------------------
const showEnableCategory = ref(false)

async function openEnableCategory() {
  await merchants.fetchGlobalCategories()
  showEnableCategory.value = true
}

const enabledCategoryIds = computed(() => new Set(categories.value.map((c) => c.id)))

async function toggleCategory(category: Category) {
  try {
    if (enabledCategoryIds.value.has(category.id)) {
      await merchants.disableCategory(merchantId.value, category.id)
    } else {
      await merchants.enableCategory(merchantId.value, category.id)
    }
  } catch {
    notifyError('merchantDetail.updateFailed')
  }
}

async function disableCategory(category: Category) {
  try {
    await merchants.disableCategory(merchantId.value, category.id)
  } catch {
    notifyError('merchantDetail.updateFailed')
  }
}

// --- Products ----------------------------------------------------------------
const showProduct = ref(false)
const editingProductId = ref<string | null>(null)
const productForm = ref<{
  categoryId: string | null
  name: string
  price: number | null
  mxikCode: string
  packageCode: number | null
  packageName: string
}>({ categoryId: null, name: '', price: null, mxikCode: '', packageCode: null, packageName: '' })
const productSaving = ref(false)

function openProduct() {
  editingProductId.value = null
  productForm.value = { categoryId: null, name: '', price: null, mxikCode: '', packageCode: null, packageName: '' }
  _resetMxik()
  showProduct.value = true
}

function openEditProduct(product: Product) {
  editingProductId.value = product.id
  productForm.value = {
    categoryId: product.categoryId,
    name: product.name,
    price: Number(product.price),
    mxikCode: product.mxikCode ?? '',
    packageCode: product.packageCode,
    packageName: product.packageName ?? '',
  }
  _resetMxik()
  if (product.mxikCode) selectedCode.value = product.mxikCode
  showProduct.value = true
}

async function submitProduct() {
  const f = productForm.value
  if (!f.categoryId || !f.name || f.price === null) return
  productSaving.value = true
  try {
    if (editingProductId.value) {
      await merchants.updateProduct(editingProductId.value, {
        categoryId: f.categoryId,
        name: f.name,
        price: String(f.price),
        mxikCode: f.mxikCode || undefined,
        packageCode: f.packageCode ?? undefined,
        packageName: f.packageName || undefined,
      })
      toast.add({ severity: 'success', summary: t('merchantDetail.productSaved'), life: 2000 })
    } else {
      await merchants.createProduct(merchantId.value, {
        categoryId: f.categoryId,
        name: f.name,
        price: String(f.price),
        mxikCode: f.mxikCode || undefined,
        packageCode: f.packageCode ?? undefined,
        packageName: f.packageName || undefined,
      })
      toast.add({ severity: 'success', summary: t('merchantDetail.productCreated'), life: 2000 })
    }
    showProduct.value = false
  } catch {
    notifyError(editingProductId.value ? 'merchantDetail.updateFailed' : 'merchantDetail.createFailed')
  } finally {
    productSaving.value = false
  }
}

// --- MXIK combobox -----------------------------------------------------------

const {
  mxikSuggestions,
  mxikSearchLoading,
  mxikLookupLoading,
  mxikData,
  mxikLookupError,
  selectedCode,
  onMxikInput: _onMxikInput,
  selectMxikSuggestion: _selectMxikSuggestion,
  resetMxik: _resetMxik,
  clearSearch,
} = useMxik('/admin/mxik')

watch(activeTab, (tab) => {
  router.replace({ query: { ...route.query, tab: tab.toLowerCase() } })
})

watch(
  () => route.query.tab,
  (q) => {
    const matched = tabs.value.find((t) => t.toLowerCase() === (q as string)?.toLowerCase())
    if (matched && matched !== activeTab.value) activeTab.value = matched
  },
)

watch(mxikLookupError, (isError) => {
  if (isError) toast.add({ severity: 'warn', summary: t('merchantDetail.mxikNotFound'), life: 2500 })
})

watch(selectedCode, () => {
  productForm.value.packageCode = null
  productForm.value.packageName = ''
})

function onMxikInputAdmin(e: Event) {
  _onMxikInput((e.target as HTMLInputElement).value)
}

function triggerMxikLookup() {
  selectedCode.value = productForm.value.mxikCode.trim()
}

function clearSearchDelayed() {
  window.setTimeout(clearSearch, 200)
}

function selectMxikSuggestionAdmin(item: MxikEntry) {
  productForm.value.mxikCode = item.mxikCode
  _selectMxikSuggestion(item)
}

function onPackageSelectAdmin(code: number) {
  const pkg = mxikData.value?.packages?.find((p: MxikPackage) => p.code === code)
  if (pkg) {
    productForm.value.packageCode = pkg.code
    productForm.value.packageName = pkg.name
  }
}

function resetMxikAdmin() {
  _resetMxik()
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
    await merchants.uploadDocument(merchantId.value, documentFile.value, documentType.value)
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

// --- Bank info ---------------------------------------------------------------
const showBankInfo = ref(false)
const bankForm = ref({ mfo: '', bankName: '', accountNumber: '' })
const bankSaving = ref(false)

function openBankInfo() {
  bankForm.value = {
    mfo: merchant.value?.mfo ?? '',
    bankName: merchant.value?.bankName ?? '',
    accountNumber: merchant.value?.accountNumber ?? '',
  }
  merchants.fetchBankList()
  showBankInfo.value = true
}

function onMfoInput() {
  const mfo = bankForm.value.mfo.trim()
  if (!/^\d{5}$/.test(mfo)) {
    bankForm.value.bankName = ''
    return
  }
  const found = merchants.bankList.find((b) => b.mfo === mfo)
  bankForm.value.bankName = found?.bankName ?? ''
}

async function submitBankInfo() {
  const f = bankForm.value
  if (!/^\d{5}$/.test(f.mfo) || !/^\d{20}$/.test(f.accountNumber) || !f.bankName) return
  bankSaving.value = true
  try {
    await merchants.update(merchantId.value, {
      mfo: f.mfo,
      accountNumber: f.accountNumber,
      bankName: f.bankName,
    })
    toast.add({ severity: 'success', summary: t('merchantDetail.bankInfoSaved'), life: 2000 })
    showBankInfo.value = false
  } catch {
    notifyError('merchantDetail.bankInfoSaveFailed')
  } finally {
    bankSaving.value = false
  }
}

// --- Merchant region ---------------------------------------------------------
const showRegionInfo = ref(false)
const regionForm = ref({ regionId: null as number | null })
const regionFormParent = ref<number | null>(null)
const regionSaving = ref(false)

function openRegionInfo() {
  const rid = merchant.value?.regionId ?? null
  regionForm.value.regionId = rid
  // Pre-populate parent select: if stored ID is a district, set its parent; if it's a region, set it directly
  const parent = lookupParent(rid)
  regionFormParent.value = parent ? parent.id : (rid ? rid : null)
  if (parent) {
    // stored ID is a district — prime the district dropdown
    onRegionChange(parent.id, () => { })
  }
  showRegionInfo.value = true
}

async function submitRegionInfo() {
  regionSaving.value = true
  try {
    await merchants.update(merchantId.value, { regionId: regionForm.value.regionId })
    toast.add({ severity: 'success', summary: t('merchantDetail.regionSaved'), life: 2000 })
    showRegionInfo.value = false
  } catch {
    notifyError('merchantDetail.regionSaveFailed')
  } finally {
    regionSaving.value = false
  }
}

// --- Tariffs -----------------------------------------------------------------
const tariffToggling = ref<Set<string>>(new Set())

async function toggleTariff(tariffId: string, currentlySelected: boolean) {
  if (tariffToggling.value.has(tariffId)) return
  tariffToggling.value.add(tariffId)
  try {
    if (currentlySelected) {
      await merchants.removeTariff(merchantId.value, tariffId)
    } else {
      await merchants.assignTariff(merchantId.value, tariffId)
    }
  } catch {
    notifyError('merchantDetail.updateFailed')
  } finally {
    tariffToggling.value.delete(tariffId)
  }
}

// --- Scoring model -------------------------------------------------------------
// Radio value 0 is the "no assignment" sentinel: the merchant follows whichever
// model is currently flagged Global (PATCH sends scoringModelId: null).
const DEFAULT_MODEL_ROW = 0

interface ScoringModelRow {
  key: string
  radioValue: number
  model: ScoringModelListItem | null
}

const scoringModelRows = computed<ScoringModelRow[]>(() => [
  { key: 'default', radioValue: DEFAULT_MODEL_ROW, model: null },
  ...scoringModels.models.map((m) => ({ key: String(m.id), radioValue: m.id, model: m })),
])

const assignedModelRadio = computed(() => merchant.value?.scoringModelId ?? DEFAULT_MODEL_ROW)
const globalModel = computed(() => scoringModels.models.find((m) => m.isGlobal) ?? null)

// What the engine will actually use: the assigned model if it has a revision,
// otherwise the Global Model (mirrors resolve-model.ts).
const effectiveModel = computed(() => {
  const assigned = scoringModels.models.find((m) => m.id === merchant.value?.scoringModelId)
  if (assigned && assigned.revisionCount > 0) return assigned
  return globalModel.value
})

const modelAssigning = ref(false)
const modelsRequested = ref(false)

watch(
  activeTab,
  (tab) => {
    if (tab !== 'ScoringModel' || modelsRequested.value) return
    modelsRequested.value = true
    scoringModels.fetchModels().catch(() => notifyError('merchantDetail.loadFailed'))
  },
  { immediate: true },
)

async function assignScoringModel(radioValue: number) {
  if (modelAssigning.value || radioValue === assignedModelRadio.value) return
  modelAssigning.value = true
  try {
    await merchants.update(merchantId.value, {
      scoringModelId: radioValue === DEFAULT_MODEL_ROW ? null : radioValue,
    })
    toast.add({ severity: 'success', summary: t('merchantDetail.scoringModelSaved'), life: 2000 })
  } catch {
    notifyError('merchantDetail.updateFailed')
  } finally {
    modelAssigning.value = false
  }
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
        <span class="t-status" :style="{
          color: merchant.active ? 'var(--success)' : 'var(--danger)',
          background: merchant.active ? 'var(--success-bg)' : 'var(--danger-bg)',
        }">
          {{ merchant.active ? $t('merchantDetail.active') : $t('merchantDetail.suspended') }}
        </span>
      </div>
      <button :class="merchant.active ? 'btn-ghost' : 'btn-gradient'" @click="toggleMerchant">
        <i :class="merchant.active ? 'pi pi-ban' : 'pi pi-check'" />
        {{ merchant.active ? $t('merchantDetail.suspend') : $t('merchantDetail.activate') }}
      </button>
    </header>

    <!-- Bank info card -->
    <div class="surface-card bank-card">
      <div class="bank-card-inner">
        <i class="pi pi-building-columns bank-icon" />
        <div class="bank-fields">
          <template v-if="merchant.mfo">
            <span class="bank-field">
              <span class="muted">{{ $t('merchantDetail.mfo') }}</span>
              <span class="font-mono">{{ merchant.mfo }}</span>
            </span>
            <span class="bank-sep">·</span>
            <span class="bank-field">
              <span class="muted">{{ $t('merchantDetail.bankName') }}</span>
              <span>{{ merchant.bankName }}</span>
            </span>
            <span class="bank-sep">·</span>
            <span class="bank-field">
              <span class="muted">{{ $t('merchantDetail.accountNumber') }}</span>
              <span class="font-mono">{{ merchant.accountNumber }}</span>
            </span>
          </template>
          <span v-else class="muted">{{ $t('merchantDetail.noBankInfo') }}</span>
        </div>
      </div>
      <button class="icon-btn" :title="$t('merchantDetail.editBankInfo')" @click="openBankInfo">
        <i class="pi pi-pencil" />
      </button>
    </div>

    <!-- Region info card -->
    <div class="surface-card bank-card">
      <div class="bank-card-inner">
        <i class="pi pi-map-marker bank-icon" />
        <div class="bank-fields">
          <template v-if="merchant.regionId">
            <span v-if="lookupParent(merchant.regionId)" class="bank-field">
              <span class="muted">{{ $t('merchantDetail.region') }}</span>
              <span>{{ lookupName(lookupParent(merchant.regionId)?.id) }}</span>
            </span>
            <span v-if="lookupParent(merchant.regionId)" class="bank-sep">·</span>
            <span class="bank-field">
              <span class="muted">{{ lookupParent(merchant.regionId) ? $t('merchantDetail.district') :
                $t('merchantDetail.region') }}</span>
              <span>{{ lookupName(merchant.regionId) }}</span>
            </span>
          </template>
          <span v-else class="muted">{{ $t('merchantDetail.noRegion') }}</span>
        </div>
      </div>
      <button class="icon-btn" :title="$t('merchantDetail.editRegion')" @click="openRegionInfo">
        <i class="pi pi-pencil" />
      </button>
    </div>

    <nav class="tabs">
      <button v-for="tab in tabs" :key="tab" class="tab" :class="{ active: activeTab === tab }"
        @click="activeTab = tab">
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
          <Column :header="$t('merchantDetail.phone')">
            <template #body="{ data }">
              <span class="font-mono muted">{{ data.phone }}</span>
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
              <Tag v-if="data.mustChangePassword" :value="$t('merchantDetail.yes')" severity="warn" />
              <span v-else class="muted">—</span>
            </template>
          </Column>
          <Column :header="$t('merchantDetail.active')">
            <template #body="{ data }">
              <ToggleSwitch :model-value="data.active" @update:model-value="toggleEmployee(data)" />
            </template>
          </Column>
          <Column style="width: 48px">
            <template #body="{ data }">
              <button class="icon-btn" :title="$t('merchantDetail.changePassword')" @click="openChangePwd(data)">
                <i class="pi pi-key" />
              </button>
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
          <Column :header="$t('merchantDetail.price')">
            <template #body="{ data }">
              <span class="font-mono">{{ formatTanNarxi(data.price) }}</span>
            </template>
          </Column>
          <Column :header="$t('merchantDetail.mxikCode')">
            <template #body="{ data }">
              <span class="font-mono muted">{{ data.mxikCode || '—' }}</span>
            </template>
          </Column>
          <Column :header="$t('merchantDetail.active')">
            <template #body="{ data }">
              <ToggleSwitch :model-value="data.active" @update:model-value="toggleProduct(data)" />
            </template>
          </Column>
          <Column style="width: 48px">
            <template #body="{ data }">
              <button class="icon-btn" :title="$t('common.edit')" @click="openEditProduct(data)">
                <i class="pi pi-pencil" />
              </button>
            </template>
          </Column>
        </DataTable>
      </div>
    </section>

    <!-- Categories -->
    <section v-else-if="activeTab === 'Categories'" class="tab-body">
      <div class="tab-head">
        <h3 class="section-title">{{ $t('merchantDetail.categories') }}</h3>
        <button class="btn-gradient" @click="openEnableCategory">
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
          <Column style="width: 48px">
            <template #body="{ data }">
              <button class="icon-btn danger" :title="$t('common.delete')" @click="disableCategory(data)">
                <i class="pi pi-trash" />
              </button>
            </template>
          </Column>
        </DataTable>
      </div>
    </section>

    <!-- Documents -->
    <section v-else-if="activeTab === 'Documents'" class="tab-body">
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

    <!-- Tariffs -->
    <section v-else-if="activeTab === 'Tariffs'" class="tab-body">
      <div class="tab-head">
        <h3 class="section-title">{{ $t('merchantDetail.tariffs') }}</h3>
      </div>
      <div class="surface-card table-wrap">
        <DataTable :value="merchantTariffs" data-key="id" size="small" :empty-message="$t('merchantDetail.noTariffs')">
          <Column field="name" :header="$t('merchantDetail.name')" sortable>
            <template #body="{ data }">
              <span class="t-name-sm">{{ data.name }}</span>
            </template>
          </Column>
          <Column :header="$t('merchantDetail.termMonths')" style="width: 120px">
            <template #body="{ data }">
              <span class="font-mono">{{ data.termMonths }} {{ $t('merchantDetail.mo') }}</span>
            </template>
          </Column>
          <Column :header="$t('merchantDetail.markupPercent')" style="width: 120px">
            <template #body="{ data }">
              <span class="font-mono markup">{{ data.markupPercent }}%</span>
            </template>
          </Column>
          <Column :header="$t('merchantDetail.attached')" style="width: 110px">
            <template #body="{ data }">
              <ToggleSwitch :model-value="data.selected" :disabled="tariffToggling.has(data.id)"
                @update:model-value="toggleTariff(data.id, data.selected)" />
            </template>
          </Column>
        </DataTable>
      </div>
    </section>

    <!-- Scoring model -->
    <section v-else class="tab-body">
      <div class="tab-head">
        <h3 class="section-title">{{ $t('merchantDetail.scoringModel') }}</h3>
      </div>
      <div class="surface-card table-wrap">
        <DataTable :value="scoringModelRows" data-key="key" size="small" :loading="scoringModels.loading">
          <Column :header="$t('merchantDetail.name')">
            <template #body="{ data }">
              <template v-if="data.model === null">
                <span class="t-name-sm">{{ $t('merchantDetail.scoringModelDefault') }}</span>
                <span v-if="globalModel" class="model-sub muted">
                  {{ $t('merchantDetail.scoringModelCurrentGlobal', { name: globalModel.name }) }}
                </span>
              </template>
              <template v-else>
                <RouterLink class="doc-link t-name-sm" :to="`/scoring-model/${data.model.id}`">
                  {{ data.model.name }}
                </RouterLink>
                <Tag v-if="data.model.isGlobal" class="model-tag"
                  :value="$t('merchantDetail.scoringModelGlobalTag')" severity="info" />
                <Tag v-if="data.model.revisionCount === 0" class="model-tag"
                  :value="$t('merchantDetail.scoringModelNoRevisions')" severity="warn" />
              </template>
            </template>
          </Column>
          <Column :header="$t('merchantDetail.scoringModelRevisions')" style="width: 110px">
            <template #body="{ data }">
              <span v-if="data.model" class="font-mono">{{ data.model.revisionCount }}</span>
              <span v-else class="muted">—</span>
            </template>
          </Column>
          <Column :header="$t('merchantDetail.scoringModelCreated')" style="width: 170px">
            <template #body="{ data }">
              <span v-if="data.model" class="font-mono muted">{{ formatDateTime(data.model.createdAt) }}</span>
              <span v-else class="muted">—</span>
            </template>
          </Column>
          <Column :header="$t('merchantDetail.scoringModelAssigned')" style="width: 110px">
            <template #body="{ data }">
              <RadioButton :model-value="assignedModelRadio" :value="data.radioValue" :disabled="modelAssigning"
                name="scoring-model" @update:model-value="assignScoringModel(data.radioValue)" />
            </template>
          </Column>
        </DataTable>
      </div>
      <p v-if="effectiveModel" class="effective-line muted">
        <i class="pi pi-info-circle" />
        {{ $t('merchantDetail.scoringModelEffective', { name: effectiveModel.name }) }}
      </p>
    </section>

    <!-- Branch dialog -->
    <Dialog v-model:visible="showBranch" modal :header="$t('merchantDetail.addBranch')" :style="{ width: '480px' }">
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
      <div class="field">
        <label class="field-label">{{ $t('merchantDetail.region') }}</label>
        <Select v-model="branchRegion" :options="regionOptions" option-label="label" option-value="value"
          :placeholder="$t('merchantDetail.selectRegion')" filter show-clear class="w-full"
          @change="onRegionChange(branchRegion, (v) => { branchForm.regionId = v })" />
      </div>
      <div class="field">
        <label class="field-label">{{ $t('merchantDetail.district') }}</label>
        <Select v-model="branchForm.regionId" :options="districtOptions" option-label="label" option-value="value"
          :placeholder="$t('merchantDetail.selectDistrict')" filter show-clear class="w-full"
          :disabled="!branchRegion" />
      </div>
      <template #footer>
        <button class="btn-ghost" @click="showBranch = false">{{ $t('common.cancel') }}</button>
        <button class="btn-gradient" :disabled="branchSaving" @click="submitBranch">
          {{ $t('merchantDetail.create') }}
        </button>
      </template>
    </Dialog>

    <!-- Employee dialog -->
    <Dialog v-model:visible="showEmployee" modal :header="$t('merchantDetail.addEmployee')" :style="{ width: '460px' }">
      <div class="field">
        <label class="field-label">{{ $t('merchantDetail.fullName') }}</label>
        <InputText v-model="employeeForm.fullName" />
      </div>
      <div class="field">
        <label class="field-label">{{ $t('merchantDetail.phone') }}</label>
        <span class="p-inputgroup-addon">+998</span>
        <InputMask v-model="employeeForm.phone" mask="999999999" class="w-full" />
      </div>
      <div class="field">
        <label class="field-label">{{ $t('merchantDetail.password') }}</label>
        <InputText v-model="employeeForm.password" type="password" />
        <span class="field-hint muted">{{ $t('merchantDetail.passwordHint') }}</span>
      </div>
      <div class="field">
        <label class="field-label">{{ $t('merchantDetail.branch') }}</label>
        <Select v-model="employeeForm.branchId" :options="branches" option-label="name" option-value="id"
          :placeholder="$t('merchantDetail.selectBranch')" />
      </div>
      <div class="field">
        <label class="field-label">{{ $t('merchantDetail.roles') }}</label>
        <MultiSelect v-model="employeeForm.roles" :options="ROLE_OPTIONS"
          :placeholder="$t('merchantDetail.selectRoles')" display="chip" />
      </div>
      <template #footer>
        <button class="btn-ghost" @click="showEmployee = false">{{ $t('common.cancel') }}</button>
        <button class="btn-gradient" :disabled="employeeSaving" @click="submitEmployee">
          {{ $t('merchantDetail.create') }}
        </button>
      </template>
    </Dialog>

    <!-- Enable category dialog -->
    <Dialog v-model:visible="showEnableCategory" modal :header="$t('merchantDetail.addCategory')" :style="{ width: '460px' }">
      <div class="category-checklist">
        <div v-for="c in merchants.globalCategories" :key="c.id" class="category-check-row">
          <span class="cat-check-name">{{ c.name }}</span>
          <button
            v-if="!enabledCategoryIds.has(c.id)"
            class="btn-gradient btn-sm"
            @click="merchants.enableCategory(merchantId, c.id)"
          >
            <i class="pi pi-plus" />
          </button>
          <span v-else class="enabled-badge"><i class="pi pi-check" /></span>
        </div>
      </div>
      <template #footer>
        <button class="btn-ghost" @click="showEnableCategory = false">{{ $t('common.close') }}</button>
      </template>
    </Dialog>

    <!-- Product dialog (create & edit) -->
    <Dialog v-model:visible="showProduct" modal
      :header="editingProductId ? $t('merchantDetail.editProduct') : $t('merchantDetail.addProduct')"
      :style="{ width: '460px' }">
      <div class="field">
        <label class="field-label">{{ $t('merchantDetail.name') }}</label>
        <InputText v-model="productForm.name" />
      </div>
      <div class="field">
        <label class="field-label">{{ $t('merchantDetail.category') }}</label>
        <Select v-model="productForm.categoryId" :options="categories" option-label="name" option-value="id"
          :placeholder="$t('merchantDetail.selectCategory')" />
      </div>
      <div class="field">
        <label class="field-label">{{ $t('merchantDetail.price') }}</label>
        <InputNumber v-model="productForm.price" :min="0" :use-grouping="true" fluid />
      </div>
      <div class="field">
        <label class="field-label">
          {{ $t('merchantDetail.mxikCode') }} <span class="muted">({{ $t('merchantDetail.optional') }})</span>
        </label>
        <div class="mxik-wrap">
          <div class="mxik-input-row">
            <InputText v-model="productForm.mxikCode" class="font-mono mxik-input"
              :placeholder="$t('merchantDetail.mxikPlaceholder')" @input="onMxikInputAdmin" @blur="clearSearchDelayed"
              @keydown.enter.prevent="triggerMxikLookup" />
            <button v-if="productForm.mxikCode && !mxikLookupLoading" class="mxik-search-btn" type="button"
              @click="triggerMxikLookup">
              <i class="pi pi-search" />
            </button>
            <span v-if="mxikLookupLoading || mxikSearchLoading" class="mxik-spinner">
              <i class="pi pi-spin pi-spinner" />
            </span>
          </div>

          <ul v-if="mxikSuggestions.length" class="mxik-suggestions">
            <li v-for="s in mxikSuggestions" :key="s.mxikCode" class="mxik-suggestion-item"
              @mousedown.prevent="selectMxikSuggestionAdmin(s)">
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
              <Select :model-value="productForm.packageCode" :options="mxikData.packages" option-label="name"
                option-value="code" :placeholder="$t('merchantDetail.selectPackage')"
                @update:model-value="onPackageSelectAdmin" />
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
          {{ editingProductId ? $t('common.save') : $t('merchantDetail.create') }}
        </button>
      </template>
    </Dialog>

    <!-- Change employee password dialog -->
    <Dialog v-model:visible="showChangePwd" modal :header="$t('merchantDetail.changePasswordTitle')"
      :style="{ width: '400px' }">
      <div class="field">
        <label class="field-label">{{ $t('merchantDetail.newPassword') }}</label>
        <InputText v-model="changePwdValue" type="password" autofocus />
        <span class="field-hint muted">{{ $t('merchantDetail.passwordHint') }}</span>
      </div>
      <template #footer>
        <button class="btn-ghost" @click="showChangePwd = false">{{ $t('common.cancel') }}</button>
        <button class="btn-gradient" :disabled="changePwdSaving || changePwdValue.length < 8" @click="submitChangePwd">
          {{ $t('merchantDetail.changePassword') }}
        </button>
      </template>
    </Dialog>

    <!-- Document dialog -->
    <Dialog v-model:visible="showDocument" modal :header="$t('merchantDetail.uploadDocument')"
      :style="{ width: '460px' }">
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
        <button class="btn-gradient" :disabled="documentUploading || !documentFile || !documentType"
          @click="submitDocument">
          {{ documentUploading ? $t('merchantDetail.uploading') : $t('merchantDetail.upload') }}
        </button>
      </template>
    </Dialog>

    <!-- Bank info dialog -->
    <Dialog v-model:visible="showBankInfo" modal :header="$t('merchantDetail.editBankInfo')"
      :style="{ width: '440px' }">
      <div class="field">
        <label class="field-label">{{ $t('merchantDetail.mfo') }}</label>
        <InputText v-model="bankForm.mfo" :placeholder="$t('merchantDetail.mfoPlaceholder')" maxlength="5"
          class="font-mono" @input="onMfoInput" />
        <span v-if="bankForm.mfo.length === 5 && !bankForm.bankName" class="field-error">
          {{ $t('merchantDetail.bankNotFound') }}
        </span>
      </div>
      <div class="field">
        <label class="field-label">{{ $t('merchantDetail.bankName') }}</label>
        <InputText :model-value="bankForm.bankName" disabled class="w-full" />
      </div>
      <div class="field">
        <label class="field-label">{{ $t('merchantDetail.accountNumber') }}</label>
        <InputText v-model="bankForm.accountNumber" :placeholder="$t('merchantDetail.accountNumberPlaceholder')"
          maxlength="20" class="font-mono" />
      </div>
      <template #footer>
        <button class="btn-ghost" @click="showBankInfo = false">{{ $t('common.cancel') }}</button>
        <button class="btn-gradient"
          :disabled="bankSaving || !/^\d{5}$/.test(bankForm.mfo) || !bankForm.bankName || !/^\d{20}$/.test(bankForm.accountNumber)"
          @click="submitBankInfo">
          {{ $t('common.save') }}
        </button>
      </template>
    </Dialog>

    <!-- Region dialog -->
    <Dialog v-model:visible="showRegionInfo" modal :header="$t('merchantDetail.editRegion')"
      :style="{ width: '440px' }">
      <div class="field">
        <label class="field-label">{{ $t('merchantDetail.region') }}</label>
        <Select v-model="regionFormParent" :options="regionOptions" option-label="label" option-value="value"
          :placeholder="$t('merchantDetail.selectRegion')" filter show-clear class="w-full"
          @change="onRegionChange(regionFormParent, (v) => { regionForm.regionId = v })" />
      </div>
      <div class="field" style="margin-top: 1rem">
        <label class="field-label">{{ $t('merchantDetail.district') }}</label>
        <Select v-model="regionForm.regionId" :options="districtOptions" option-label="label" option-value="value"
          :placeholder="$t('merchantDetail.selectDistrict')" filter show-clear class="w-full"
          :disabled="!regionFormParent" />
      </div>
      <template #footer>
        <button class="btn-ghost" @click="showRegionInfo = false">{{ $t('common.cancel') }}</button>
        <button class="btn-gradient" :disabled="regionSaving" @click="submitRegionInfo">
          {{ $t('common.save') }}
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

.bank-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.2rem;
  gap: 1rem;
}

.bank-card-inner {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  flex-wrap: wrap;
  min-width: 0;
}

.bank-icon {
  color: var(--text-secondary);
  font-size: 1rem;
  flex-shrink: 0;
}

.bank-fields {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  font-size: 0.85rem;
}

.bank-field {
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.bank-sep {
  color: var(--border-subtle);
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
  position: relative;
}

.p-inputgroup-addon {
  color: var(--text-secondary);
  position: absolute;
  pointer-events: none;
  display: flex;
  align-items: center;
  top: 38px;
  left: 10px;
}

.p-inputgroup-addon+.p-inputmask {
  padding-left: 3.25rem;
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
.mxik-wrap {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.mxik-input-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.mxik-input {
  flex: 1;
}

.mxik-search-btn {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-surface);
  color: var(--text-secondary);
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: all 0.15s ease;
}

.mxik-search-btn:hover {
  color: var(--accent-2);
  border-color: var(--accent-2);
}

.mxik-spinner {
  color: var(--text-secondary);
  font-size: 1rem;
}

.mxik-suggestions {
  position: absolute;
  top: 38px;
  left: 0;
  right: 0;
  background: var(--bg-card, #fff);
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, .08);
  z-index: 100;
  max-height: 220px;
  overflow-y: auto;
  list-style: none;
  margin: 4px 0 0;
  padding: 4px 0;
}

.mxik-suggestion-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 12px;
  cursor: pointer;
}

.mxik-suggestion-item:hover {
  background: var(--bg-surface);
}

.sug-code {
  font-family: monospace;
  font-size: 11px;
  color: var(--text-secondary);
}

.sug-name {
  font-size: 13px;
  color: var(--text-primary);
}

.mxik-result {
  margin-top: 0.5rem;
  padding: 0.75rem;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background: var(--bg-surface);
}

.mxik-result-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.mxik-result-name {
  font-size: 0.85rem;
  font-weight: 600;
  flex: 1;
}

.mxik-label-badge {
  font-size: 0.7rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 20px;
  background: var(--accent-2);
  color: #fff;
}

.mxik-clear-btn {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  display: grid;
  place-items: center;
  font-size: 0.75rem;
}

.mxik-clear-btn:hover {
  color: var(--danger);
}

.mxik-hint {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin: 4px 0 0;
}

.markup {
  color: var(--accent-2);
  font-weight: 700;
}

.model-sub {
  display: block;
  font-size: 0.75rem;
  margin-top: 0.15rem;
}

.model-tag {
  margin-left: 0.5rem;
}

.effective-line {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.82rem;
  margin: 0;
}

.icon-btn {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-base);
  color: var(--text-secondary);
  cursor: pointer;
  display: grid;
  place-items: center;
  font-size: 0.78rem;
  transition: all 0.12s ease;
}

.icon-btn:hover {
  color: var(--accent-2);
  border-color: var(--accent-2);
}

.w-full {
  width: 100%;
}
</style>
