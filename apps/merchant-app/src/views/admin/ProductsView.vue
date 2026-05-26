<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import SkeletonTable from '@/components/SkeletonTable.vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { useCatalogStore } from '@/stores/catalog'
import type { Product } from '@/types'

const catalog = useCatalogStore()
const confirm = useConfirm()
const toast = useToast()
const { t } = useI18n()

onMounted(() => catalog.fetchAll())

const dialogVisible = ref(false)
const editingId = ref<string | null>(null)

const form = reactive({
  name: '',
  mxikCode: '',
  tanNarxiNum: 0,
  categoryId: '',
})

function openNew() {
  editingId.value = null
  form.name = ''
  form.mxikCode = ''
  form.tanNarxiNum = 0
  form.categoryId = catalog.categories[0]?.id ?? ''
  dialogVisible.value = true
}

function openEdit(p: Product) {
  editingId.value = p.id
  form.name = p.name
  form.mxikCode = p.mxikCode ?? ''
  form.tanNarxiNum = parseFloat(p.tanNarxi)
  form.categoryId = p.categoryId
  dialogVisible.value = true
}

async function save() {
  if (!form.name || !form.categoryId || form.tanNarxiNum <= 0) {
    toast.add({ severity: 'warn', summary: t('products.missingFields'), detail: t('products.fillAllFields'), life: 2500 })
    return
  }
  const tanNarxi = form.tanNarxiNum.toFixed(2)
  try {
    if (editingId.value) {
      await catalog.updateProduct(editingId.value, { name: form.name, categoryId: form.categoryId, tanNarxi, mxikCode: form.mxikCode || undefined })
      toast.add({ severity: 'success', summary: t('products.updated'), detail: form.name, life: 2000 })
    } else {
      await catalog.addProduct({ name: form.name, categoryId: form.categoryId, tanNarxi, mxikCode: form.mxikCode || undefined })
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
      <div class="page-actions">
        <button class="btn-gradient" @click="openNew">
          <i class="pi pi-plus" /> {{ $t('products.addProduct') }}
        </button>
      </div>

      <div class="surface-card table-wrap">
        <DataTable :value="catalog.products" paginator :rows="10" data-key="id">
          <Column field="name" :header="$t('products.name')" sortable :style="{ minWidth: '200px' }" />
          <Column :header="$t('products.category')" :style="{ width: '160px' }">
            <template #body="{ data }">
              <span class="cat-chip">{{ catalog.categoryName(data.categoryId) }}</span>
            </template>
          </Column>
          <Column :header="$t('products.tanNarxi')" :style="{ width: '180px' }">
            <template #body="{ data }">
              <span class="font-mono">{{ formatPrice(data.tanNarxi) }} {{ $t('common.som') }}</span>
            </template>
          </Column>
          <Column :header="$t('products.mxikCode')" :style="{ width: '140px' }">
            <template #body="{ data }">
              <span class="font-mono muted">{{ data.mxikCode || '—' }}</span>
            </template>
          </Column>
          <Column header="" :style="{ width: '90px' }">
            <template #body="{ data }">
              <div class="row-actions">
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

      <Dialog
        v-model:visible="dialogVisible"
        modal
        :header="editingId ? $t('products.editProduct') : $t('products.addProductTitle')"
        :style="{ width: '460px' }"
      >
        <div class="form">
          <div class="field">
            <label class="field-label">{{ $t('products.name') }}</label>
            <InputText v-model="form.name" :placeholder="$t('products.productName')" />
          </div>
          <div class="field">
            <label class="field-label">{{ $t('products.category') }}</label>
            <Select
              v-model="form.categoryId"
              :options="catalog.categories"
              option-label="name"
              option-value="id"
              :placeholder="$t('products.selectCategory')"
            />
          </div>
          <div class="field">
            <label class="field-label">{{ $t('products.tanNarxi') }}</label>
            <InputNumber v-model="form.tanNarxiNum" :min="0" mode="decimal" :min-fraction-digits="0" :max-fraction-digits="2" fluid />
          </div>
          <div class="field">
            <label class="field-label">{{ $t('products.mxikCode') }} <span class="optional">({{ $t('common.optional') }})</span></label>
            <InputText v-model="form.mxikCode" placeholder="1234567890" class="font-mono" />
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
.admin-page { display: flex; flex-direction: column; gap: 1.3rem; }
.page-actions { display: flex; justify-content: flex-end; }
.btn-gradient { display: inline-flex; align-items: center; gap: 0.5rem; }
.table-wrap { padding: 0; overflow: hidden; }
.cat-chip {
  background: var(--bg-surface);
  padding: 0.25rem 0.65rem;
  border-radius: 8px;
  font-size: 0.78rem;
  font-weight: 700;
}
.muted { color: var(--text-secondary); }
.row-actions { display: flex; gap: 0.4rem; }
.ra-btn {
  width: 32px; height: 32px; border-radius: 8px;
  border: 1px solid var(--border-subtle); background: var(--bg-surface);
  color: var(--text-secondary); cursor: pointer; display: grid;
  place-items: center; transition: all 0.15s ease;
}
.ra-btn:hover { color: var(--accent-2); border-color: var(--accent-2); }
.ra-btn.danger:hover { color: var(--danger); border-color: var(--danger); }
.form { display: flex; flex-direction: column; gap: 1rem; padding-top: 0.4rem; }
.form :deep(.p-inputnumber), .form :deep(.p-select) { width: 100%; }
.optional { font-size: 0.78rem; color: var(--text-secondary); font-weight: 400; }
</style>
