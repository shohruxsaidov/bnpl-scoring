<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
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
const { t } = useI18n()

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
    toast.add({ severity: 'warn', summary: t('tariffs.nameRequired'), life: 2000 })
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
    toast.add({ severity: 'success', summary: t('tariffs.updated'), life: 2000 })
  } else {
    catalog.addTariff(payload)
    toast.add({ severity: 'success', summary: t('tariffs.added'), life: 2000 })
  }
  dialogVisible.value = false
}

function remove(tariff: Tariff) {
  confirm.require({
    message: t('tariffs.deleteConfirm', { name: tariff.name }),
    header: t('tariffs.confirmDelete'),
    icon: 'pi pi-trash',
    rejectProps: { label: t('common.cancel'), severity: 'secondary', outlined: true },
    acceptProps: { label: t('common.delete'), severity: 'danger' },
    accept: () => {
      catalog.deleteTariff(tariff.id)
      toast.add({ severity: 'info', summary: t('tariffs.deleted'), life: 2000 })
    },
  })
}

function fmt(tiyin: number) {
  return (tiyin / 100).toLocaleString('uz-UZ')
}
</script>

<template>
  <div class="admin-page">
    <div class="page-actions">
      <button class="btn-gradient" @click="openNew">
        <i class="pi pi-plus" /> {{ $t('tariffs.addTariff') }}
      </button>
    </div>

    <div class="surface-card table-wrap">
      <DataTable :value="catalog.tariffs" data-key="id">
        <Column field="name" :header="$t('tariffs.name')" sortable>
          <template #body="{ data }">
            <span class="t-name">{{ data.name }}</span>
          </template>
        </Column>
        <Column :header="$t('tariffs.term')">
          <template #body="{ data }">
            <span class="font-mono">{{ data.termMonths }} {{ $t('tariffs.mo') }}</span>
          </template>
        </Column>
        <Column :header="$t('tariffs.markup')">
          <template #body="{ data }">
            <span class="markup font-mono">{{ data.markupPercent }}%</span>
          </template>
        </Column>
        <Column :header="$t('tariffs.creditRange')">
          <template #body="{ data }">
            <span class="font-mono range">
              {{ fmt(data.creditMin) }} – {{ fmt(data.creditMax) }} {{ $t('common.som') }}
            </span>
          </template>
        </Column>
        <Column :header="$t('tariffs.active')">
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
      :header="editingId ? $t('tariffs.editTariff') : $t('tariffs.addTariffTitle')"
      :style="{ width: '480px' }"
    >
      <div class="form">
        <div class="field">
          <label class="field-label">{{ $t('tariffs.name') }}</label>
          <InputText v-model="form.name" placeholder="12 oy · 12%" />
        </div>
        <div class="grid2">
          <div class="field">
            <label class="field-label">{{ $t('tariffs.termMonths') }}</label>
            <InputNumber v-model="form.termMonths" :min="1" :max="36" fluid />
          </div>
          <div class="field">
            <label class="field-label">{{ $t('tariffs.markupPercent') }}</label>
            <InputNumber v-model="form.markupPercent" :min="0" :max="100" fluid />
          </div>
        </div>
        <div class="grid2">
          <div class="field">
            <label class="field-label">{{ $t('tariffs.creditMin') }}</label>
            <InputNumber v-model="form.creditMinSom" :min="0" fluid />
          </div>
          <div class="field">
            <label class="field-label">{{ $t('tariffs.creditMax') }}</label>
            <InputNumber v-model="form.creditMaxSom" :min="0" fluid />
          </div>
        </div>
        <label class="active-toggle">
          <ToggleSwitch v-model="form.active" />
          <span>{{ $t('tariffs.active') }}</span>
        </label>
      </div>
      <template #footer>
        <button class="btn-ghost" @click="dialogVisible = false">{{ $t('common.cancel') }}</button>
        <button class="btn-gradient" @click="save">{{ $t('common.save') }}</button>
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
