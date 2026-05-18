<script setup lang="ts">
import { ref, reactive } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { useCatalogStore } from '@/stores/catalog'
import MonoAmount from '@/components/MonoAmount.vue'
import type { Product } from '@/types'

const catalog = useCatalogStore()
const confirm = useConfirm()
const toast = useToast()

const dialogVisible = ref(false)
const editingId = ref<string | null>(null)

const form = reactive({
  name: '',
  sku: '',
  /** stored in som in the form; converted to tiyin on save */
  priceSom: 0,
  categoryId: '' as string,
})

function openNew() {
  editingId.value = null
  form.name = ''
  form.sku = ''
  form.priceSom = 0
  form.categoryId = catalog.categories[0]?.id ?? ''
  dialogVisible.value = true
}

function openEdit(p: Product) {
  editingId.value = p.id
  form.name = p.name
  form.sku = p.sku
  form.priceSom = p.price / 100
  form.categoryId = p.categoryId
  dialogVisible.value = true
}

function save() {
  if (!form.name || !form.sku || !form.categoryId) {
    toast.add({ severity: 'warn', summary: 'Missing fields', detail: 'Fill all fields', life: 2500 })
    return
  }
  const payload = {
    name: form.name,
    sku: form.sku,
    price: Math.round(form.priceSom * 100),
    categoryId: form.categoryId,
  }
  if (editingId.value) {
    catalog.updateProduct(editingId.value, payload)
    toast.add({ severity: 'success', summary: 'Updated', detail: form.name, life: 2000 })
  } else {
    catalog.addProduct(payload)
    toast.add({ severity: 'success', summary: 'Added', detail: form.name, life: 2000 })
  }
  dialogVisible.value = false
}

function remove(p: Product) {
  confirm.require({
    message: `Delete "${p.name}"?`,
    header: 'Confirm delete',
    icon: 'pi pi-trash',
    rejectProps: { label: 'Cancel', severity: 'secondary', outlined: true },
    acceptProps: { label: 'Delete', severity: 'danger' },
    accept: () => {
      catalog.deleteProduct(p.id)
      toast.add({ severity: 'info', summary: 'Deleted', detail: p.name, life: 2000 })
    },
  })
}
</script>

<template>
  <div class="admin-page">
    <div class="page-actions">
      <button class="btn-gradient" @click="openNew">
        <i class="pi pi-plus" /> Add Product
      </button>
    </div>

    <div class="surface-card table-wrap">
      <DataTable :value="catalog.products" paginator :rows="8" data-key="id">
        <Column field="name" header="Name" sortable :style="{ minWidth: '200px' }" />
        <Column header="SKU" :style="{ width: '160px' }">
          <template #body="{ data }">
            <span class="font-mono sku">{{ data.sku }}</span>
          </template>
        </Column>
        <Column header="Category" :style="{ width: '160px' }">
          <template #body="{ data }">
            <span class="cat-chip">{{ catalog.categoryName(data.categoryId) }}</span>
          </template>
        </Column>
        <Column header="Price" :style="{ width: '180px' }">
          <template #body="{ data }">
            <MonoAmount :value="data.price" size="sm" />
          </template>
        </Column>
        <Column header="" :style="{ width: '90px' }">
          <template #body="{ data }">
            <div class="row-actions">
              <button class="ra-btn" title="Edit" @click="openEdit(data)">
                <i class="pi pi-pencil" />
              </button>
              <button class="ra-btn danger" title="Delete" @click="remove(data)">
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
      :header="editingId ? 'Edit product' : 'Add product'"
      :style="{ width: '460px' }"
    >
      <div class="form">
        <div class="field">
          <label class="field-label">Name</label>
          <InputText v-model="form.name" placeholder="Product name" />
        </div>
        <div class="field">
          <label class="field-label">SKU</label>
          <InputText v-model="form.sku" placeholder="ABC-123" class="font-mono" />
        </div>
        <div class="field">
          <label class="field-label">Price (so'm)</label>
          <InputNumber v-model="form.priceSom" :min="0" mode="decimal" fluid />
        </div>
        <div class="field">
          <label class="field-label">Category</label>
          <Select
            v-model="form.categoryId"
            :options="catalog.categories"
            option-label="name"
            option-value="id"
            placeholder="Select category"
          />
        </div>
      </div>
      <template #footer>
        <button class="btn-ghost" @click="dialogVisible = false">Cancel</button>
        <button class="btn-gradient" @click="save">Save</button>
      </template>
    </Dialog>
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
.sku {
  font-size: 0.82rem;
  color: var(--text-secondary);
}
.cat-chip {
  background: var(--bg-surface);
  padding: 0.25rem 0.65rem;
  border-radius: 8px;
  font-size: 0.78rem;
  font-weight: 700;
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
</style>
