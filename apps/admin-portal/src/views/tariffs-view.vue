<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Dialog from 'primevue/dialog'
import Drawer from 'primevue/drawer'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import ToggleSwitch from 'primevue/toggleswitch'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { z } from 'zod'
import { useRouter } from 'vue-router'
import { useTariffsStore } from '@/stores/tariffs'
import { formatSomShort } from '@/utils/money'
import type { Tariff } from '@/types'

function rangeLabel(tariff: Tariff): string {
  if (tariff.minAmount == null && tariff.maxAmount == null) return '—'
  const min = tariff.minAmount != null ? formatSomShort(tariff.minAmount) : '0'
  const max = tariff.maxAmount != null ? formatSomShort(tariff.maxAmount) : '∞'
  return `${min} – ${max}`
}

const tariffs = useTariffsStore()
const toast = useToast()
const confirm = useConfirm()
const router = useRouter()
const { t } = useI18n()

const showDialog = ref(false)
const editingId = ref<string | null>(null)
const saving = ref(false)

const showMerchants = ref(false)
const selectedTariff = ref<Tariff | null>(null)
const merchantsLoading = ref(false)

async function openMerchants(tariff: Tariff) {
  selectedTariff.value = tariff
  showMerchants.value = true
  if (!tariffs.tariffMerchants[tariff.id]) {
    merchantsLoading.value = true
    try {
      await tariffs.fetchMerchants(tariff.id)
    } catch {
      toast.add({ severity: 'error', summary: t('tariffs.merchantsLoadFailed'), life: 3000 })
    } finally {
      merchantsLoading.value = false
    }
  }
}

const schema = toTypedSchema(
  z
    .object({
      name: z.string().min(1, t('tariffs.nameRequired')),
      termMonths: z.number().int().min(1).max(120),
      markupPercent: z.number().min(0).max(100),
      // Credit Range entered in so'm; null/undefined = unbounded
      minSom: z.number().min(0).nullish(),
      maxSom: z.number().min(0).nullish(),
    })
    .refine((v) => v.minSom == null || v.maxSom == null || v.minSom <= v.maxSom, {
      message: t('tariffs.rangeInvalid'),
      path: ['maxSom'],
    }),
)

const { handleSubmit, errors, defineField, resetForm, setValues } = useForm({
  validationSchema: schema,
  initialValues: { name: '', termMonths: 6, markupPercent: 8, minSom: null, maxSom: null },
})

const [name, nameAttrs] = defineField('name')
const [termMonths, termMonthsAttrs] = defineField('termMonths')
const [markupPercent, markupPercentAttrs] = defineField('markupPercent')
const [minSom, minSomAttrs] = defineField('minSom')
const [maxSom, maxSomAttrs] = defineField('maxSom')

onMounted(() => {
  tariffs.fetchAll().catch(() => toast.add({ severity: 'error', summary: t('tariffs.loadFailed'), life: 3000 }))
})

function openNew() {
  editingId.value = null
  resetForm()
  showDialog.value = true
}

function openEdit(tariff: Tariff) {
  editingId.value = tariff.id
  setValues({
    name: tariff.name,
    termMonths: tariff.termMonths,
    markupPercent: tariff.markupPercent,
    minSom: tariff.minAmount,
    maxSom: tariff.maxAmount,
  })
  showDialog.value = true
}

const submit = handleSubmit(async (values) => {
  saving.value = true
  const minAmount = values.minSom != null ? Math.round(values.minSom) : null
  const maxAmount = values.maxSom != null ? Math.round(values.maxSom) : null
  try {
    if (editingId.value) {
      await tariffs.update(editingId.value, {
        name: values.name,
        termMonths: values.termMonths,
        markupPercent: values.markupPercent,
        minAmount,
        maxAmount,
      })
      toast.add({ severity: 'success', summary: t('tariffs.updated'), life: 2000 })
    } else {
      await tariffs.create({
        name: values.name,
        termMonths: values.termMonths,
        markupPercent: values.markupPercent,
        minAmount,
        maxAmount,
      })
      toast.add({ severity: 'success', summary: t('tariffs.created'), life: 2000 })
    }
    showDialog.value = false
  } catch {
    toast.add({ severity: 'error', summary: editingId.value ? t('tariffs.updateFailed') : t('tariffs.createFailed'), life: 3000 })
  } finally {
    saving.value = false
  }
})

function remove(tariff: Tariff) {
  confirm.require({
    message: t('tariffs.deleteConfirm', { name: tariff.name }),
    header: t('common.delete'),
    icon: 'pi pi-exclamation-triangle',
    rejectProps: { label: t('common.cancel'), severity: 'secondary', outlined: true },
    acceptProps: { label: t('common.delete'), severity: 'danger' },
    accept: async () => {
      try {
        await tariffs.remove(tariff.id)
        toast.add({ severity: 'info', summary: t('tariffs.deleted'), life: 2000 })
      } catch {
        toast.add({ severity: 'error', summary: t('tariffs.updateFailed'), life: 3000 })
      }
    },
  })
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">{{ $t('tariffs.title') }}</h1>
        <p class="page-sub">{{ $t('tariffs.summary', { count: tariffs.tariffs.length }) }}</p>
      </div>
      <button class="btn-gradient" @click="openNew">
        <i class="pi pi-plus" /> {{ $t('tariffs.addTariff') }}
      </button>
    </div>

    <div class="surface-card table-wrap">
      <DataTable :value="tariffs.tariffs" :loading="tariffs.loading" data-key="id" row-hover @row-click="openMerchants($event.data)">
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
            <span class="font-mono">{{ rangeLabel(data) }}</span>
          </template>
        </Column>
        <Column :header="$t('tariffs.active')">
          <template #body="{ data }">
            <div @click.stop>
              <ToggleSwitch
                :model-value="data.active"
                @update:model-value="tariffs.update(data.id, { active: !data.active })"
              />
            </div>
          </template>
        </Column>
        <Column header="" :style="{ width: '8rem' }">
          <template #body="{ data }">
            <div class="row-actions" @click.stop>
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

    <Drawer
      v-model:visible="showMerchants"
      position="right"
      :header="selectedTariff?.name ?? ''"
      :style="{ width: '420px' }"
    >
      <div class="drawer-content">
        <p class="drawer-sub">{{ $t('tariffs.merchants') }}</p>
        <div v-if="merchantsLoading" class="drawer-loading">
          <i class="pi pi-spin pi-spinner" />
        </div>
        <template v-else-if="selectedTariff">
          <div v-if="tariffs.merchantsFor(selectedTariff.id).length === 0" class="drawer-empty">
            {{ $t('tariffs.merchantsEmpty') }}
          </div>
          <ul v-else class="merchant-list">
            <li v-for="m in tariffs.merchantsFor(selectedTariff.id)" :key="m.id" class="merchant-item">
              <div class="merchant-row">
                <div class="merchant-info">
                  <a class="merchant-name merchant-link" @click="router.push({ name: 'merchant-detail', params: { id: m.id } }); showMerchants = false">{{ m.name }}</a>
                  <span class="merchant-meta">{{ m.legalName }} · {{ m.inn }}</span>
                </div>
                <span class="merchant-status" :class="m.active ? 'status-active' : 'status-inactive'">
                  {{ m.active ? $t('common.active') : $t('common.inactive') }}
                </span>
              </div>
              <span class="merchant-added">{{ $t('tariffs.addedAt') }}: {{ new Date(m.addedAt).toLocaleDateString() }}</span>
            </li>
          </ul>
        </template>
      </div>
    </Drawer>

    <Dialog
      v-model:visible="showDialog"
      modal
      :header="editingId ? $t('tariffs.editTariff') : $t('tariffs.addTariff')"
      :style="{ width: '480px' }"
    >
      <form class="form" @submit.prevent="submit">
        <div class="field">
          <label class="field-label">{{ $t('tariffs.name') }}</label>
          <InputText v-model="name" v-bind="nameAttrs" fluid :placeholder="$t('tariffs.namePlaceholder')" />
          <small v-if="errors.name" class="field-error">{{ errors.name }}</small>
        </div>
        <div class="grid2">
          <div class="field">
            <label class="field-label">{{ $t('tariffs.termMonths') }}</label>
            <InputNumber v-model="termMonths" v-bind="termMonthsAttrs" :min="1" :max="120" fluid />
          </div>
          <div class="field">
            <label class="field-label">{{ $t('tariffs.markupPercent') }}</label>
            <InputNumber v-model="markupPercent" v-bind="markupPercentAttrs" :min="0" :max="100" :max-fraction-digits="2" fluid />
          </div>
        </div>
        <div class="grid2">
          <div class="field">
            <label class="field-label">{{ $t('tariffs.creditMin') }}</label>
            <InputNumber v-model="minSom" v-bind="minSomAttrs" :min="0" :max-fraction-digits="0" :placeholder="$t('tariffs.unbounded')" fluid />
          </div>
          <div class="field">
            <label class="field-label">{{ $t('tariffs.creditMax') }}</label>
            <InputNumber v-model="maxSom" v-bind="maxSomAttrs" :min="0" :max-fraction-digits="0" :placeholder="$t('tariffs.unbounded')" fluid />
            <small v-if="errors.maxSom" class="field-error">{{ errors.maxSom }}</small>
          </div>
        </div>
      </form>
      <template #footer>
        <button class="btn-ghost" @click="showDialog = false">{{ $t('common.cancel') }}</button>
        <button class="btn-gradient" :disabled="saving" @click="submit">
          {{ saving ? '…' : $t('common.save') }}
        </button>
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}
.page-title {
  font-size: 1.4rem;
  font-weight: 800;
  margin: 0;
}
.page-sub {
  font-size: 0.84rem;
  color: var(--text-secondary);
  margin: 0.2rem 0 0;
}
.table-wrap {
  padding: 1.4rem;
  overflow-x: auto;
}
.t-name {
  font-weight: 700;
}
.markup {
  color: var(--accent-2);
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
.grid2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
.field-label {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text-secondary);
}
.field-error {
  color: var(--danger);
  font-size: 0.78rem;
}
.form :deep(.p-inputnumber) {
  width: 100%;
}

@media (max-width: 600px) {
  .grid2 { grid-template-columns: 1fr; }
}

/* Merchants drawer */
.drawer-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 0.25rem 0;
}
.drawer-sub {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text-secondary);
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.drawer-loading {
  display: flex;
  justify-content: center;
  padding: 2rem 0;
  color: var(--text-secondary);
  font-size: 1.4rem;
}
.drawer-empty {
  color: var(--text-secondary);
  font-size: 0.88rem;
  padding: 1.5rem 0;
  text-align: center;
}
.merchant-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.merchant-item {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  padding: 0.75rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
.merchant-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
}
.merchant-info {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}
.merchant-name {
  font-weight: 700;
  font-size: 0.9rem;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.merchant-link {
  color: var(--accent-1);
  cursor: pointer;
  text-decoration: none;
}
.merchant-link:hover {
  text-decoration: underline;
}
.merchant-meta {
  font-size: 0.78rem;
  color: var(--text-secondary);
}
.merchant-status {
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.15rem 0.5rem;
  border-radius: 6px;
  white-space: nowrap;
  flex-shrink: 0;
}
.status-active {
  background: color-mix(in srgb, #22c55e 15%, transparent);
  color: #22c55e;
}
.status-inactive {
  background: color-mix(in srgb, var(--text-secondary) 15%, transparent);
  color: var(--text-secondary);
}
.merchant-added {
  font-size: 0.75rem;
  color: var(--text-secondary);
}
</style>
