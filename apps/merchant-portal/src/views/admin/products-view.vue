<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import SkeletonTable from '@/components/skeleton-table.vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { useCatalogStore } from '@/stores/catalog'
import { useMxik, type MxikPackage, type MxikEntry } from '@/composables/useMxik'
import type { Product } from '@/types'
import { useAuthStore } from '@/stores/auth'

const catalog = useCatalogStore()
const confirm = useConfirm()
const toast = useToast()
const auth = useAuthStore()
const { t } = useI18n()

const search = ref('')
const filteredProducts = computed(() => {
  if (!search.value.trim()) return catalog.products
  const q = search.value.toLowerCase()
  return catalog.products.filter(
    (p) => p.name.toLowerCase().includes(q) || (p.mxikCode ?? '').includes(q),
  )
})

onMounted(() => catalog.fetchProducts())

const dialogVisible = ref(false)
const editingId = ref<string | null>(null)

const form = reactive({
  name: '',
  mxikCode: '',
  priceNum: 0,
  categoryId: '',
  packageCode: null as number | null,
  packageName: '',
})

// ── MXIK combobox state ────────────────────────────────────────────────────

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
} = useMxik('/merchant/mxik')

watch(mxikLookupError, (isError) => {
  if (isError) toast.add({ severity: 'warn', summary: t('products.mxikNotFound'), life: 2500 })
})

watch(selectedCode, () => {
  form.packageCode = null
  form.packageName = ''
})

function onMxikInput(e: Event) {
  _onMxikInput((e.target as HTMLInputElement).value)
}

function triggerLookupFromForm() {
  selectedCode.value = form.mxikCode.trim()
}

function selectMxikSuggestion(item: MxikEntry) {
  form.mxikCode = item.mxikCode
  _selectMxikSuggestion(item)
}

function onPackageSelect(pkg: MxikPackage) {
  form.packageCode = pkg.code
  form.packageName = pkg.name
}

function resetMxik() {
  _resetMxik()
  form.packageCode = null
  form.packageName = ''
}

function onMxikBlur() {
  window.setTimeout(clearSearch, 200)
}

// ── Form open/close ────────────────────────────────────────────────────────

async function openNew() {
  await catalog.fetchCategories()
  editingId.value = null
  form.name = ''
  form.mxikCode = ''
  form.priceNum = 0
  form.categoryId = catalog.categories[0]?.id ?? ''
  form.packageCode = null
  form.packageName = ''
  _resetMxik()
  dialogVisible.value = true
}

async function openEdit(p: Product) {
  await catalog.fetchCategories()
  editingId.value = p.id
  form.name = p.name
  form.mxikCode = p.mxikCode ?? ''
  form.priceNum = parseFloat(p.price)
  form.categoryId = p.categoryId
  form.packageCode = p.packageCode ?? null
  form.packageName = p.packageName ?? ''
  _resetMxik()
  dialogVisible.value = true
}

async function save() {
  if (!form.name || !form.categoryId || form.priceNum <= 0) {
    toast.add({ severity: 'warn', summary: t('products.missingFields'), detail: t('products.fillAllFields'), life: 2500 })
    return
  }
  const price = form.priceNum.toFixed(2)
  try {
    if (editingId.value) {
      await catalog.updateProduct(editingId.value, {
        name: form.name,
        categoryId: form.categoryId,
        price,
        mxikCode: form.mxikCode || undefined,
        packageCode: form.packageCode ?? undefined,
        packageName: form.packageName || undefined,
      })
      toast.add({ severity: 'success', summary: t('products.updated'), detail: form.name, life: 2000 })
    } else {
      await catalog.addProduct({
        name: form.name,
        categoryId: form.categoryId,
        price,
        mxikCode: form.mxikCode || undefined,
        packageCode: form.packageCode ?? undefined,
        packageName: form.packageName || undefined,
      })
      toast.add({ severity: 'success', summary: t('products.added'), detail: form.name, life: 2000 })
    }
    dialogVisible.value = false
  } catch {
    toast.add({ severity: 'error', summary: t('common.error'), life: 2500 })
  }
}

function remove(p: Product) {
  confirm.require({
    message: t('products.deleteConfirm', { name: p.name }),
    header: t('products.confirmDelete'),
    icon: 'pi pi-trash',
    rejectProps: { label: t('common.cancel'), severity: 'secondary', outlined: true },
    acceptProps: { label: t('common.delete'), severity: 'danger' },
    accept: async () => {
      await catalog.deleteProduct(p.id)
      toast.add({ severity: 'info', summary: t('products.deleted'), detail: p.name, life: 2000 })
    },
  })
}

function formatPrice(v: string) {
  return new Intl.NumberFormat('uz-UZ').format(parseFloat(v))
}
</script>

<template>
  <div class="admin-page">
    <SkeletonTable v-if="catalog.loading" :rows="8" :cols="4" :has-actions="true" :has-header="true" />

    <template v-else>
      <div class="surface-card table-toolbar">
        <div class="tt-search">
          <i class="pi pi-search tt-icon" />
          <input v-model="search" class="tt-input" :placeholder="$t('products.searchPlaceholder')" type="text" />
        </div>
        <span class="tt-count">{{ filteredProducts.length }} {{ $t('products.productsCount') }}</span>
        <button v-if="auth.can('manage_products')" class="btn-gradient" style="margin-left: auto" @click="openNew">
          <i class="pi pi-plus" /> {{ $t('products.addProduct') }}
        </button>
      </div>

      <div class="surface-card table-wrap">
        <DataTable :value="filteredProducts" paginator :rows="10" data-key="id">
          <Column field="name" :header="$t('products.name')" sortable :style="{ minWidth: '200px' }" />
          <Column :header="$t('products.category')" :style="{ width: '160px' }">
            <template #body="{ data }">
              <span class="cat-chip">{{ catalog.categoryName(data.categoryId) }}</span>
            </template>
          </Column>
          <Column field="price" :header="$t('products.price')" sortable :style="{ width: '180px' }">
            <template #body="{ data }">
              <span class="font-mono">{{ formatPrice(data.price) }} {{ $t('common.som') }}</span>
            </template>
          </Column>
          <Column :header="$t('products.mxikCode')" :style="{ width: '140px' }">
            <template #body="{ data }">
              <span class="font-mono muted">{{ data.mxikCode || '—' }}</span>
            </template>
          </Column>
          <Column header="" :style="{ width: '90px' }">
            <template #body="{ data }">
              <div class="row-actions" v-if="auth.can('manage_products')">
                <button class="ra-btn" :title="$t('common.edit')" @click="openEdit(data)">
                  <i class="pi pi-pencil" />
                </button>
                <button class="ra-btn danger" :title="$t('common.delete')" @click="remove(data)">
                  <i class="pi pi-trash" />
                </button>
              </div>
            </template>
          </Column>
        </DataTable>
      </div>

      <Dialog v-model:visible="dialogVisible" modal
        :header="editingId ? $t('products.editProduct') : $t('products.addProductTitle')" :style="{ width: '480px' }">
        <div class="form">
          <div class="field">
            <label class="field-label">{{ $t('products.name') }}</label>
            <InputText v-model="form.name" :placeholder="$t('products.productName')" />
          </div>
          <div class="field">
            <label class="field-label">{{ $t('products.category') }}</label>
            <Select v-model="form.categoryId" :options="catalog.categories" option-label="name" option-value="id"
              :placeholder="$t('products.selectCategory')" />
          </div>
          <div class="field">
            <label class="field-label">{{ $t('products.price') }}</label>
            <InputNumber v-model="form.priceNum" :min="0" mode="decimal" :min-fraction-digits="0"
              :max-fraction-digits="2" fluid />
          </div>

          <!-- MXIK combobox -->
          <div class="field">
            <label class="field-label">
              {{ $t('products.mxikCode') }} <span class="optional">({{ $t('common.optional') }})</span>
            </label>
            <div class="mxik-wrap">
              <div class="mxik-input-row">
                <InputText v-model="form.mxikCode" class="font-mono mxik-input"
                  :placeholder="$t('products.mxikPlaceholder')" @input="onMxikInput" @blur="onMxikBlur"
                  @keydown.enter.prevent="triggerLookupFromForm" />
                <button v-if="form.mxikCode && !mxikLookupLoading" class="mxik-search-btn" type="button"
                  @click="triggerLookupFromForm">
                  <i class="pi pi-search" />
                </button>
                <span v-if="mxikLookupLoading || mxikSearchLoading" class="mxik-spinner">
                  <i class="pi pi-spin pi-spinner" />
                </span>
              </div>

              <!-- Suggestions dropdown -->
              <ul v-if="mxikSuggestions.length" class="mxik-suggestions">
                <li v-for="s in mxikSuggestions" :key="s.mxikCode" class="mxik-suggestion-item"
                  @mousedown.prevent="selectMxikSuggestion(s)">
                  <span class="sug-code">{{ s.mxikCode }}</span>
                  <span class="sug-name">{{ s.mxikName }}</span>
                </li>
              </ul>

              <!-- Result card -->
              <div v-if="mxikData" class="mxik-result">
                <div class="mxik-result-header">
                  <span class="mxik-result-name">{{ mxikData.mxikName }}</span>
                  <span v-if="mxikData.label" class="mxik-label-badge">{{ $t('products.mxikLabeled') }}</span>
                  <button class="mxik-clear-btn" type="button" @click="resetMxik">
                    <i class="pi pi-times" />
                  </button>
                </div>
                <div v-if="mxikData.packages?.length" class="field" style="margin-top: 0.75rem; margin-bottom: 0">
                  <label class="field-label">{{ $t('products.packageCode') }}</label>
                  <Select :model-value="form.packageCode" :options="mxikData.packages" option-label="name"
                    option-value="code" :placeholder="$t('products.selectPackage')"
                    @update:model-value="(code) => { const pkg = mxikData!.packages!.find((p: MxikPackage) => p.code === code); if (pkg) onPackageSelect(pkg as MxikPackage) }" />
                </div>
              </div>

              <!-- Hint for new codes -->
              <p v-if="!mxikData && form.mxikCode && form.mxikCode.length < 17" class="mxik-hint">
                {{ $t('products.mxikHint') }}
              </p>
            </div>
          </div>
        </div>

        <template #footer>
          <button class="btn-ghost" @click="dialogVisible = false">{{ $t('common.cancel') }}</button>
          <button class="btn-gradient" @click="save">{{ $t('common.save') }}</button>
        </template>
      </Dialog>
    </template>
  </div>
</template>

<style scoped>
.admin-page {
  display: flex;
  flex-direction: column;
  gap: 1.3rem;
}

.page-actions {
  display: flex;
  justify-content: flex-end;
}

.btn-gradient {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.table-wrap {
  padding: 0;
  overflow: hidden;
}

.cat-chip {
  background: var(--bg-surface);
  padding: 0.25rem 0.65rem;
  border-radius: 8px;
  font-size: 0.78rem;
  font-weight: 700;
}

.muted {
  color: var(--text-secondary);
}

.row-actions {
  display: flex;
  gap: 0.4rem;
}

.ra-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-surface);
  color: var(--text-secondary);
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: all 0.15s ease;
}

.ra-btn:hover {
  color: var(--accent-2);
  border-color: var(--accent-2);
}

.ra-btn.danger:hover {
  color: var(--danger);
  border-color: var(--danger);
}

.form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-top: 0.4rem;
}

.form :deep(.p-inputnumber),
.form :deep(.p-select) {
  width: 100%;
}

.optional {
  font-size: 0.78rem;
  color: var(--text-secondary);
  font-weight: 400;
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
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
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
</style>
