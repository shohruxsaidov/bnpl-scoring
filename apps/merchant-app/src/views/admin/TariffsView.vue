<script setup lang="ts">
import { ref, reactive } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import ToggleSwitch from 'primevue/toggleswitch'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { useCatalogStore } from '@/stores/catalog'
import type { Tariff } from '@/types'

const catalog = useCatalogStore()
const confirm = useConfirm()
const toast = useToast()

const dialogVisible = ref(false)
const editingId = ref<string | null>(null)

const form = reactive({
  name: '',
  termMonths: 6,
  markupPercent: 8,
  creditMinSom: 0,
  creditMaxSom: 0,
  active: true,
})

function openNew() {
  editingId.value = null
  Object.assign(form, {
    name: '',
    termMonths: 6,
    markupPercent: 8,
    creditMinSom: 0,
    creditMaxSom: 0,
    active: true,
  })
  dialogVisible.value = true
}

function openEdit(t: Tariff) {
  editingId.value = t.id
  Object.assign(form, {
    name: t.name,
    termMonths: t.termMonths,
    markupPercent: t.markupPercent,
    creditMinSom: t.creditMin / 100,
    creditMaxSom: t.creditMax / 100,
    active: t.active,
  })
  dialogVisible.value = true
}

function save() {
  if (!form.name) {
    toast.add({ severity: 'warn', summary: 'Name required', life: 2000 })
    return
  }
  const payload = {
    name: form.name,
    termMonths: form.termMonths,
    markupPercent: form.markupPercent,
    creditMin: Math.round(form.creditMinSom * 100),
    creditMax: Math.round(form.creditMaxSom * 100),
    active: form.active,
  }
  if (editingId.value) {
    catalog.updateTariff(editingId.value, payload)
    toast.add({ severity: 'success', summary: 'Updated', life: 2000 })
  } else {
    catalog.addTariff(payload)
    toast.add({ severity: 'success', summary: 'Added', life: 2000 })
  }
  dialogVisible.value = false
}

function remove(t: Tariff) {
  confirm.require({
    message: `Delete tariff "${t.name}"?`,
    header: 'Confirm delete',
    icon: 'pi pi-trash',
    rejectProps: { label: 'Cancel', severity: 'secondary', outlined: true },
    acceptProps: { label: 'Delete', severity: 'danger' },
    accept: () => {
      catalog.deleteTariff(t.id)
      toast.add({ severity: 'info', summary: 'Deleted', life: 2000 })
    },
  })
}

function fmt(tiyin: number) {
  return (tiyin / 100).toLocaleString('uz-UZ')
}
</script>

<template>
  <div class="admin-page">
    <div class="ap-head">
      <div>
        <h2>Tariffs</h2>
        <p>{{ catalog.tariffs.length }} credit plans</p>
      </div>
      <button class="btn-gradient" @click="openNew">
        <i class="pi pi-plus" /> Add Tariff
      </button>
    </div>

    <div class="surface-card table-wrap">
      <DataTable :value="catalog.tariffs" data-key="id">
        <Column field="name" header="Name" sortable>
          <template #body="{ data }">
            <span class="t-name">{{ data.name }}</span>
          </template>
        </Column>
        <Column header="Term">
          <template #body="{ data }">
            <span class="font-mono">{{ data.termMonths }} mo</span>
          </template>
        </Column>
        <Column header="Ustama">
          <template #body="{ data }">
            <span class="markup font-mono">{{ data.markupPercent }}%</span>
          </template>
        </Column>
        <Column header="Credit range">
          <template #body="{ data }">
            <span class="font-mono range">
              {{ fmt(data.creditMin) }} – {{ fmt(data.creditMax) }} so'm
            </span>
          </template>
        </Column>
        <Column header="Active">
          <template #body="{ data }">
            <ToggleSwitch
              :model-value="data.active"
              @update:model-value="catalog.toggleTariffActive(data.id)"
            />
          </template>
        </Column>
        <Column header="" :style="{ width: '8rem' }">
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
      :header="editingId ? 'Edit tariff' : 'Add tariff'"
      :style="{ width: '480px' }"
    >
      <div class="form">
        <div class="field">
          <label class="field-label">Name</label>
          <InputText v-model="form.name" placeholder="12 oy · 12%" />
        </div>
        <div class="grid2">
          <div class="field">
            <label class="field-label">Term (months)</label>
            <InputNumber v-model="form.termMonths" :min="1" :max="36" fluid />
          </div>
          <div class="field">
            <label class="field-label">Ustama %</label>
            <InputNumber v-model="form.markupPercent" :min="0" :max="100" fluid />
          </div>
        </div>
        <div class="grid2">
          <div class="field">
            <label class="field-label">Credit min (so'm)</label>
            <InputNumber v-model="form.creditMinSom" :min="0" fluid />
          </div>
          <div class="field">
            <label class="field-label">Credit max (so'm)</label>
            <InputNumber v-model="form.creditMaxSom" :min="0" fluid />
          </div>
        </div>
        <label class="active-toggle">
          <ToggleSwitch v-model="form.active" />
          <span>Active</span>
        </label>
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
.ap-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.ap-head h2 {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 800;
}
.ap-head p {
  margin: 0.2rem 0 0;
  color: var(--text-secondary);
  font-size: 0.86rem;
}
.btn-gradient {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}
.table-wrap {
  padding: 1.4rem;
}
.t-name {
  font-weight: 700;
}
.markup {
  color: var(--accent-2);
  font-weight: 700;
}
.range {
  font-size: 0.8rem;
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
.grid2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}
.form :deep(.p-inputnumber) {
  width: 100%;
}
.active-toggle {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-weight: 700;
  font-size: 0.88rem;
}
</style>
